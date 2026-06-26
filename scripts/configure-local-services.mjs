import { resolve } from 'node:path';

import { upsertEnvironment } from './environment-file.mjs';

await upsertEnvironment(resolve('apps/api/.env.local'), {
  API_PORT: '4000',
  DATABASE_URL: 'postgresql://suppline:suppline@localhost:55432/suppline',
  NODE_ENV: 'development',
  REDIS_URL: 'redis://localhost:56379',
  S3_ACCESS_KEY: 'suppline',
  S3_BUCKET: 'suppline-local',
  S3_ENDPOINT: 'http://localhost:59000',
  S3_REGION: 'us-east-1',
  S3_SECRET_KEY: 'change-this-local-secret',
});

await upsertEnvironment(resolve('apps/web/.env.local'), {
  API_INTERNAL_URL: 'http://localhost:4000',
});

await upsertEnvironment(resolve('apps/worker/.env.local'), {
  DATABASE_URL: 'postgresql://suppline:suppline@localhost:55432/suppline',
  NODE_ENV: 'development',
  REDIS_URL: 'redis://localhost:56379',
  S3_ACCESS_KEY: 'suppline',
  S3_BUCKET: 'suppline-local',
  S3_ENDPOINT: 'http://localhost:59000',
  S3_REGION: 'us-east-1',
  S3_SECRET_KEY: 'change-this-local-secret',
});

process.stdout.write('Configured ignored local service environment values.\n');
