import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';

import { DatabaseService } from './database.service';
import { WorkspaceEmbeddingService } from './embedding.service';
import { validateWorkerEnvironment } from './environment';
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
      validate: validateWorkerEnvironment,
    }),
  ],
  providers: [
    DatabaseService,
    WorkspaceEmbeddingService,
    KnowledgeIndexProcessor,
    KnowledgeIndexRepository,
    OutboxPublisher,
    SourceStorageService,
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useExisting: WorkspaceEmbeddingService,
    },
  ],
})
export class WorkerModule {}
