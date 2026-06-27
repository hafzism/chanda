import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  isKnowledgeIndexJob,
  KNOWLEDGE_INDEX_QUEUE,
  type KnowledgeIndexJob,
} from '@suppline/contracts';
import { chunkKnowledgeText } from '@suppline/knowledge';
import { type Job, Worker } from 'bullmq';

import { type EmbeddingProvider } from './embedding.service';
import { KnowledgeIndexRepository } from './knowledge-index.repository';
import { redisConnection } from './redis-connection';
import { SourceStorageService } from './source-storage.service';

export const EMBEDDING_PROVIDER_TOKEN = Symbol('EMBEDDING_PROVIDER');

@Injectable()
export class KnowledgeIndexProcessor
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(KnowledgeIndexProcessor.name);
  private worker: Worker<KnowledgeIndexJob> | null = null;

  constructor(
    private readonly repository: KnowledgeIndexRepository,
    private readonly storage: SourceStorageService,
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddings: EmbeddingProvider,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<KnowledgeIndexJob>(
      KNOWLEDGE_INDEX_QUEUE,
      (job) => this.process(job),
      { concurrency: 2, connection: redisConnection() },
    );
    this.worker.on('failed', (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      void this.repository
        .fail(job.data, error.message)
        .catch((failure: unknown) =>
          this.logger.error(
            `Unable to record final failure for ${job.id}: ${String(failure)}`,
          ),
        );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  async process(job: Job<KnowledgeIndexJob>): Promise<void> {
    if (!isKnowledgeIndexJob(job.data)) {
      throw new Error('Knowledge indexing job payload is invalid.');
    }
    if (!(await this.repository.claim(job.data))) return;

    const source = await this.storage.readText(job.data.objectKey);
    const chunks = chunkKnowledgeText(source);
    if (chunks.length === 0)
      throw new Error('Knowledge source produced no chunks.');

    const vectors: number[][] = [];
    for (let offset = 0; offset < chunks.length; offset += 32) {
      const batch = chunks.slice(offset, offset + 32);
      vectors.push(
        ...(await this.embeddings.embedDocuments(
          batch.map((chunk) =>
            chunk.heading
              ? `${chunk.heading}\n\n${chunk.content}`
              : chunk.content,
          ),
        )),
      );
    }
    await this.repository.complete(job.data, chunks, vectors);
  }
}
