import { resolve } from 'node:path';

import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client';
import { users, workspaceMembers, workspaces } from '../src/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for database integration tests.');
}

const client = createDatabaseClient(connectionString);

describe('database migrations', () => {
  beforeAll(async () => {
    await migrate(client.db, {
      migrationsFolder: resolve(process.cwd(), 'migrations'),
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it('enables the extensions required by tenant and retrieval data', async () => {
    const result = await client.db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname in ('citext', 'vector') order by extname`,
    );

    expect(result.rows.map((row) => row.extname)).toEqual(['citext', 'vector']);
  });

  it('creates a workspace with exactly one owner membership', async () => {
    const suffix = crypto.randomUUID();
    const [user] = await client.db
      .insert(users)
      .values({
        email: `owner-${suffix}@example.com`,
        firebaseUid: `firebase-${suffix}`,
      })
      .returning();

    expect(user).toBeDefined();
    if (!user) return;

    const [workspace] = await client.db
      .insert(workspaces)
      .values({
        createdByUserId: user.id,
        name: 'Integration workspace',
        slug: `integration-${suffix}`,
      })
      .returning();

    expect(workspace).toBeDefined();
    if (!workspace) return;

    try {
      await client.db.insert(workspaceMembers).values({
        role: 'owner',
        userId: user.id,
        workspaceId: workspace.id,
      });

      const memberships = await client.db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspace.id));

      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.role).toBe('owner');
    } finally {
      await client.db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      await client.db.delete(users).where(eq(users.id, user.id));
    }
  });

  it('creates tenant-filtered hybrid retrieval indexes at 1536 dimensions', async () => {
    const vectorColumn = await client.db.execute<{ data_type: string }>(sql`
      select format_type(attribute.atttypid, attribute.atttypmod) as data_type
      from pg_attribute attribute
      join pg_class relation on relation.oid = attribute.attrelid
      where relation.relname = 'knowledge_chunks'
        and attribute.attname = 'embedding'
        and not attribute.attisdropped
    `);
    const indexes = await client.db.execute<{
      indexdef: string;
      indexname: string;
    }>(sql`
      select indexname, indexdef
      from pg_indexes
      where tablename = 'knowledge_chunks'
        and indexname in (
          'knowledge_chunks_content_fts_idx',
          'knowledge_chunks_embedding_hnsw_idx',
          'knowledge_chunks_workspace_idx'
        )
      order by indexname
    `);

    expect(vectorColumn.rows[0]?.data_type).toBe('vector(1536)');
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'knowledge_chunks_content_fts_idx',
      'knowledge_chunks_embedding_hnsw_idx',
      'knowledge_chunks_workspace_idx',
    ]);
    expect(indexes.rows[0]?.indexdef).toContain(
      "to_tsvector('english'::regconfig",
    );
    expect(indexes.rows[1]?.indexdef).toContain('USING hnsw');
    expect(indexes.rows[1]?.indexdef).toContain('vector_cosine_ops');
  });

  it('creates a deduplicated pending-event outbox index', async () => {
    const indexes = await client.db.execute<{
      indexdef: string;
      indexname: string;
    }>(sql`
      select indexname, indexdef
      from pg_indexes
      where tablename = 'outbox_events'
        and indexname in (
          'outbox_events_pending_idx',
          'outbox_events_topic_aggregate_unique'
        )
      order by indexname
    `);

    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'outbox_events_pending_idx',
      'outbox_events_topic_aggregate_unique',
    ]);
    expect(indexes.rows[0]?.indexdef).toContain('published_at IS NULL');
    expect(indexes.rows[1]?.indexdef).toContain('UNIQUE');
  });

  it('creates idempotent channel messages and tenant ticket indexes', async () => {
    const indexes = await client.db.execute<{
      indexdef: string;
      indexname: string;
    }>(sql`
      select indexname, indexdef
      from pg_indexes
      where indexname in (
        'messages_connection_external_unique',
        'tickets_workspace_number_unique',
        'conversations_connection_thread_unique'
      )
      order by indexname
    `);

    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'conversations_connection_thread_unique',
      'messages_connection_external_unique',
      'tickets_workspace_number_unique',
    ]);
    expect(indexes.rows[1]?.indexdef).toContain(
      'external_message_id IS NOT NULL',
    );
    expect(indexes.rows.every((row) => row.indexdef.includes('UNIQUE'))).toBe(
      true,
    );
  });

  it('defaults widget allowed origins to a non-null empty list', async () => {
    const columns = await client.db.execute<{
      column_default: string;
      is_nullable: string;
    }>(sql`
      select column_default, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'channel_connections'
        and column_name = 'allowed_origins'
    `);

    expect(columns.rows[0]?.is_nullable).toBe('NO');
    expect(columns.rows[0]?.column_default).toContain('ARRAY[]');
  });
});
