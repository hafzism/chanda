import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';

import { DatabaseService } from './database.service';
import { GeminiEmbeddingService } from './embedding.service';
import {
  EMBEDDING_PROVIDER_TOKEN,
  KnowledgeIndexProcessor,
} from './knowledge-index.processor';
import { KnowledgeIndexRepository } from './knowledge-index.repository';
import { OutboxPublisher } from './outbox.publisher';
import { SourceStorageService } from './source-storage.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        join(__dirname, '..', '.env.local'),
        join(__dirname, '..', '..', '..', '.env'),
        '.env.local',
      ],
      isGlobal: true,
    }),
  ],
  providers: [
    DatabaseService,
    GeminiEmbeddingService,
    KnowledgeIndexProcessor,
    KnowledgeIndexRepository,
    OutboxPublisher,
    SourceStorageService,
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useExisting: GeminiEmbeddingService,
    },
  ],
})
export class WorkerModule {}
