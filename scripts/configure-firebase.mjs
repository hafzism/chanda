import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { upsertEnvironment } from './environment-file.mjs';

function readArguments(values) {
  const options = new Map();

  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith('--') || !value) {
      throw new Error(`Missing value for ${name ?? 'an option'}.`);
    }
    options.set(name.slice(2), value);
  }

  return options;
}

function required(options, name) {
  const value = options.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

const options = readArguments(process.argv.slice(2));
const serviceAccountPath = resolve(required(options, 'service-account'));
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

for (const key of ['project_id', 'client_email', 'private_key']) {
  if (typeof serviceAccount[key] !== 'string' || !serviceAccount[key]) {
    throw new Error(`The service-account JSON is missing ${key}.`);
  }
}

const configuredProjectId = required(options, 'project-id');
if (configuredProjectId !== serviceAccount.project_id) {
  throw new Error('The web and Admin Firebase project IDs do not match.');
}

await upsertEnvironment(resolve('apps/web/.env.local'), {
  API_INTERNAL_URL: 'http://localhost:4000',
  NEXT_PUBLIC_FIREBASE_API_KEY: required(options, 'api-key'),
  NEXT_PUBLIC_FIREBASE_APP_ID: required(options, 'app-id'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: required(options, 'auth-domain'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: configuredProjectId,
});

await upsertEnvironment(resolve('apps/api/.env.local'), {
  API_PORT: '4000',
  DATABASE_URL: 'postgresql://suppline:suppline@localhost:55432/suppline',
  FIREBASE_CLIENT_EMAIL: serviceAccount.client_email,
  FIREBASE_PRIVATE_KEY: serviceAccount.private_key,
  FIREBASE_PROJECT_ID: serviceAccount.project_id,
  NODE_ENV: 'development',
  REDIS_URL: 'redis://localhost:56379',
  S3_ACCESS_KEY: 'suppline',
  S3_BUCKET: 'suppline-local',
  S3_ENDPOINT: 'http://localhost:59000',
  S3_REGION: 'us-east-1',
  S3_SECRET_KEY: 'change-this-local-secret',
});

process.stdout.write(
  'Configured ignored Firebase environment files for the web and API apps.\n',
);
