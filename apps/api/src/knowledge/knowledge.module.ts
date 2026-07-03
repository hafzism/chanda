import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { DrizzleKnowledgeRepository } from './drizzle-knowledge.repository';
import { KnowledgeController } from './knowledge.controller';
import {
  KNOWLEDGE_REPOSITORY,
  KnowledgeService,
  QUERY_EMBEDDING_PROVIDER,
} from './knowledge.service';
import { GeminiQueryEmbeddingService } from './query-embedding.service';

@Module({
  controllers: [KnowledgeController],
  exports: [KnowledgeService],
  imports: [AuthModule, WorkspaceModule],
  providers: [
    KnowledgeService,
    GeminiQueryEmbeddingService,
    {
      provide: QUERY_EMBEDDING_PROVIDER,
      useExisting: GeminiQueryEmbeddingService,
    },
    { provide: KNOWLEDGE_REPOSITORY, useClass: DrizzleKnowledgeRepository },
  ],
})
export class KnowledgeModule {}
