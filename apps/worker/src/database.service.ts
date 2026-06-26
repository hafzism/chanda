import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@suppline/database';

function databaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production.');
  }
  return 'postgresql://suppline:suppline@localhost:55432/suppline';
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly client = createDatabaseClient(databaseUrl());
  readonly db: DatabaseClient['db'] = this.client.db;

  onApplicationShutdown(): Promise<void> {
    return this.client.close();
  }
}
