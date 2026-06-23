import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDatabaseClient } from './client';

loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run database migrations.');
  }

  const client = createDatabaseClient(connectionString);
  try {
    await migrate(client.db, {
      migrationsFolder: resolve(process.cwd(), 'migrations'),
    });
  } finally {
    await client.close();
  }
}

void main();
