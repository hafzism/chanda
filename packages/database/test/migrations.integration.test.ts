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

  it('stores a separate extracted source key for uploaded knowledge files', async () => {
    const columns = await client.db.execute<{
      data_type: string;
      is_nullable: string;
    }>(sql`
      select data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_document_versions'
        and column_name = 'extracted_object_key'
    `);

    expect(columns.rows[0]).toEqual({
      data_type: 'text',
      is_nullable: 'YES',
    });
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
    expect(indexes.rows[1]?.indexdef).toContain('published_at IS NULL');
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

  it('stores only a fixed-length widget conversation capability hash', async () => {
    const columns = await client.db.execute<{
      character_maximum_length: number;
      data_type: string;
      is_nullable: string;
    }>(sql`
      select data_type, character_maximum_length, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'conversations'
        and column_name = 'public_access_token_hash'
    `);

    expect(columns.rows[0]).toEqual({
      character_maximum_length: 64,
      data_type: 'character',
      is_nullable: 'YES',
    });
  });

  it('creates auditable AI drafts with tenant and status indexes', async () => {
    const indexes = await client.db.execute<{
      indexname: string;
    }>(sql`
      select indexname
      from pg_indexes
      where tablename = 'ai_drafts'
        and indexname in (
          'ai_drafts_workspace_status_idx',
          'ai_drafts_workspace_ticket_created_idx'
        )
      order by indexname
    `);
    const columns = await client.db.execute<{
      column_name: string;
    }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'ai_drafts'
        and column_name in (
          'citations',
          'model',
          'prompt_version',
          'readiness_score',
          'requires_human'
        )
      order by column_name
    `);

    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'ai_drafts_workspace_status_idx',
      'ai_drafts_workspace_ticket_created_idx',
    ]);
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      'citations',
      'model',
      'prompt_version',
      'readiness_score',
      'requires_human',
    ]);
  });

  it('supports revocable invitations with one active invite per email', async () => {
    const columns = await client.db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'workspace_invitations'
        and column_name = 'revoked_at'
    `);
    const indexes = await client.db.execute<{ indexdef: string }>(sql`
      select indexdef
      from pg_indexes
      where tablename = 'workspace_invitations'
        and indexname = 'workspace_invitations_pending_email_unique'
    `);
    const constraints = await client.db.execute<{ definition: string }>(sql`
      select pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conname = 'workspace_invitations_role_not_owner'
    `);

    expect(columns.rows).toHaveLength(1);
    expect(indexes.rows[0]?.indexdef).toContain('accepted_at IS NULL');
    expect(indexes.rows[0]?.indexdef).toContain('revoked_at IS NULL');
    expect(constraints.rows[0]?.definition).toContain("role <> 'owner'");
  });

  it('persists tenant-scoped retrieval evaluation cases and immutable runs', async () => {
    const tables = await client.db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'retrieval_evaluation_cases',
          'retrieval_evaluation_results',
          'retrieval_evaluation_runs'
        )
      order by table_name
    `);
    const indexes = await client.db.execute<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where indexname in (
        'retrieval_evaluation_cases_workspace_question_unique',
        'retrieval_evaluation_results_run_idx',
        'retrieval_evaluation_runs_workspace_created_idx'
      )
      order by indexname
    `);

    expect(tables.rows.map((row) => row.table_name)).toEqual([
      'retrieval_evaluation_cases',
      'retrieval_evaluation_results',
      'retrieval_evaluation_runs',
    ]);
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'retrieval_evaluation_cases_workspace_question_unique',
      'retrieval_evaluation_results_run_idx',
      'retrieval_evaluation_runs_workspace_created_idx',
    ]);
  });

  it('stores channel credentials separately from public connection metadata', async () => {
    const columns = await client.db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'channel_connection_secrets'
      order by column_name
    `);
    const settings = await client.db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'channel_connections'
        and column_name = 'settings'
    `);
    const indexes = await client.db.execute<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where indexname = 'channel_connection_secrets_connection_unique'
    `);

    expect(columns.rows.map(({ column_name }) => column_name)).toContain(
      'encrypted_credentials',
    );
    expect(columns.rows.map(({ column_name }) => column_name)).toContain(
      'webhook_secret_hash',
    );
    expect(settings.rows).toHaveLength(1);
    expect(indexes.rows).toHaveLength(1);
  });

  it('stores expiring one-time OAuth state without requiring webhook credentials', async () => {
    const oauthColumns = await client.db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'oauth_connection_states'
      order by column_name
    `);
    const webhookColumn = await client.db.execute<{ is_nullable: string }>(sql`
      select is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'channel_connection_secrets'
        and column_name = 'webhook_secret_hash'
    `);
    const indexes = await client.db.execute<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where indexname in (
        'oauth_connection_states_expiry_idx',
        'oauth_connection_states_hash_unique',
        'oauth_connection_states_workspace_idx'
      )
      order by indexname
    `);

    expect(oauthColumns.rows.map(({ column_name }) => column_name)).toEqual(
      expect.arrayContaining([
        'expires_at',
        'state_hash',
        'used_at',
        'workspace_id',
      ]),
    );
    expect(webhookColumn.rows[0]?.is_nullable).toBe('YES');
    expect(indexes.rows).toHaveLength(3);
  });

  it('supports separate Facebook and Instagram channel connections', async () => {
    const values = await client.db.execute<{ value: string }>(sql`
      select value
      from unnest(enum_range(null::support_channel_kind)) as value
      where value::text in ('facebook', 'instagram')
      order by value::text
    `);

    expect(values.rows.map(({ value }) => value)).toEqual([
      'facebook',
      'instagram',
    ]);
  });

  it('persists one billing account per workspace and idempotent Stripe events', async () => {
    const indexes = await client.db.execute<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where indexname in (
        'workspace_billing_accounts_workspace_unique',
        'workspace_billing_accounts_customer_unique',
        'stripe_webhook_events_pkey'
      )
      order by indexname
    `);
    const statuses = await client.db.execute<{ value: string }>(sql`
      select value
      from unnest(enum_range(null::billing_subscription_status)) as value
      order by value::text
    `);

    expect(indexes.rows).toHaveLength(3);
    expect(statuses.rows.map(({ value }) => value)).toEqual(
      expect.arrayContaining(['active', 'past_due', 'canceled', 'unpaid']),
    );
  });
});
