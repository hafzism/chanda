import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@suppline/database';

const LOCAL_DATABASE_URL =
  'postgresql://suppline:suppline@localhost:55432/suppline';

function readDatabaseUrl(): string {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production.');
  }

  return LOCAL_DATABASE_URL;
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly client: DatabaseClient =
    createDatabaseClient(readDatabaseUrl());

  readonly db: DatabaseClient['db'] = this.client.db;

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
