import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  isKnowledgeIndexJob,
  KNOWLEDGE_INDEX_QUEUE,
  KNOWLEDGE_VERSION_INDEX_REQUESTED,
  type KnowledgeIndexJob,
} from '@suppline/contracts';
import { sql } from '@suppline/database';
import { Queue } from 'bullmq';

import { DatabaseService } from './database.service';
import { redisConnection } from './redis-connection';

interface OutboxRecord extends Record<string, unknown> {
  id: string;
  payload: unknown;
  topic: string;
}

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly queue = new Queue<KnowledgeIndexJob>(KNOWLEDGE_INDEX_QUEUE, {
    connection: redisConnection(),
  });
  private timer: NodeJS.Timeout | null = null;
  private publishing = false;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.publishAvailable(), 1_000);
    this.timer.unref();
    void this.publishAvailable();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.queue.close();
  }

  async publishAvailable(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      for (let count = 0; count < 20; count += 1) {
        const event = await this.claimNext();
        if (!event) break;
        await this.publish(event);
      }
    } finally {
      this.publishing = false;
    }
  }

  private async claimNext(): Promise<OutboxRecord | null> {
    const result = await this.database.db.execute<OutboxRecord>(sql`
      update outbox_events
      set
        attempts = attempts + 1,
        available_at = now() + interval '30 seconds',
        last_error = null
      where id = (
        select id
        from outbox_events
        where published_at is null and available_at <= now()
        order by created_at, id
        for update skip locked
        limit 1
      )
      returning id, topic, payload
    `);
    return result.rows[0] ?? null;
  }

  private async publish(event: OutboxRecord): Promise<void> {
    try {
      if (
        event.topic !== KNOWLEDGE_VERSION_INDEX_REQUESTED ||
        !isKnowledgeIndexJob(event.payload)
      ) {
        throw new Error(`Unsupported outbox event: ${event.topic}`);
      }

      await this.queue.add(event.topic, event.payload, {
        attempts: 5,
        backoff: { delay: 2_000, type: 'exponential' },
        jobId: event.id,
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
        removeOnFail: { age: 30 * 24 * 60 * 60 },
      });
      await this.database.db.execute(sql`
        update outbox_events
        set published_at = now(), last_error = null
        where id = ${event.id} and published_at is null
      `);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Publish failed.';
      await this.database.db.execute(sql`
        update outbox_events
        set last_error = ${message}, available_at = now() + interval '30 seconds'
        where id = ${event.id} and published_at is null
      `);
      this.logger.error(
        `Outbox event ${event.id} was not published: ${message}`,
      );
    }
  }
}
