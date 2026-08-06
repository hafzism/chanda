import { Module } from '@nestjs/common';

import { AiConfigurationModule } from '../ai/ai-configuration.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { DrizzleKnowledgeRepository } from './drizzle-knowledge.repository';
import { KnowledgeController } from './knowledge.controller';
import {
  KNOWLEDGE_REPOSITORY,
  KnowledgeService,
  QUERY_EMBEDDING_PROVIDER,
} from './knowledge.service';
import { WorkspaceQueryEmbeddingService } from './query-embedding.service';

@Module({
  controllers: [KnowledgeController],
  exports: [KnowledgeService],
  imports: [AiConfigurationModule, AuthModule, WorkspaceModule],
  providers: [
    KnowledgeService,
    WorkspaceQueryEmbeddingService,
    {
      provide: QUERY_EMBEDDING_PROVIDER,
      useExisting: WorkspaceQueryEmbeddingService,
    },
    { provide: KNOWLEDGE_REPOSITORY, useClass: DrizzleKnowledgeRepository },
  ],
})
export class KnowledgeModule {}
