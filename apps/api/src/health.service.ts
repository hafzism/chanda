import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

import { DatabaseService } from './database/database.service';

@Injectable()
export class HealthService implements OnApplicationShutdown {
  private readonly redis = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:56379',
    {
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    },
  );

  constructor(private readonly database: DatabaseService) {}

  async ready(): Promise<void> {
    await Promise.all([this.database.ping(), this.redis.ping()]);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'ready') await this.redis.quit();
    else this.redis.disconnect();
  }
}
