import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { AnalyticsController } from './analytics.controller';
import { ANALYTICS_REPOSITORY, AnalyticsService } from './analytics.service';
import { DrizzleAnalyticsRepository } from './drizzle-analytics.repository';
import { DrizzleEvaluationRepository } from './drizzle-evaluation.repository';
import { EvaluationController } from './evaluation.controller';
import { EVALUATION_REPOSITORY, EvaluationService } from './evaluation.service';

@Module({
  controllers: [AnalyticsController, EvaluationController],
  imports: [AuthModule, KnowledgeModule, WorkspaceModule],
  providers: [
    AnalyticsService,
    { provide: ANALYTICS_REPOSITORY, useClass: DrizzleAnalyticsRepository },
    EvaluationService,
    { provide: EVALUATION_REPOSITORY, useClass: DrizzleEvaluationRepository },
  ],
})
export class AnalyticsModule {}
