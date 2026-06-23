import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

export default defineConfig({
  dialect: 'postgresql',
  out: './migrations',
  schema: './src/schema.ts',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://suppline:suppline@localhost:55432/suppline',
  },
  strict: true,
  verbose: true,
});
