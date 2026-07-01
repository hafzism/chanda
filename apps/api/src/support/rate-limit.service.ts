import { createHash } from 'node:crypto';

import {
  HttpException,
  HttpStatus,
  Injectable,
  type OnApplicationShutdown,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService implements OnApplicationShutdown {
  private redis: Redis | null = null;

  private getRedis(): Redis {
    this.redis ??= new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:56379',
      {
        connectTimeout: 1_000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      },
    );
    return this.redis;
  }

  async consumeWidgetMessage(
    publicKey: string,
    ipAddress: string,
  ): Promise<void> {
    await this.consume(`message:${publicKey}`, ipAddress, 20);
  }

  async consumeWidgetRead(publicKey: string, ipAddress: string): Promise<void> {
    await this.consume(`read:${publicKey}`, ipAddress, 120);
  }

  private async consume(
    scope: string,
    ipAddress: string,
    limit: number,
  ): Promise<void> {
    const fingerprint = createHash('sha256')
      .update(`${scope}:${ipAddress}`)
      .digest('hex');
    const key = `rate:widget:${fingerprint}`;
    const count = await this.getRedis().eval(
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count;",
      1,
      key,
      60,
    );

    if (Number(count) > limit) {
      throw new HttpException(
        'Too many messages. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis?.status === 'ready') await this.redis.quit();
    else this.redis?.disconnect();
  }
}
