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
});
