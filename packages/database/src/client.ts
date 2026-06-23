import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

export interface DatabaseClient {
  close: () => Promise<void>;
  db: ReturnType<typeof drizzle<typeof schema>>;
  pool: Pool;
}

export function createDatabaseClient(connectionString: string): DatabaseClient {
  const pool = new Pool({
    allowExitOnIdle: true,
    connectionString,
    max: 10,
  });
  const db = drizzle(pool, { schema });

  return {
    close: async () => pool.end(),
    db,
    pool,
  };
}
