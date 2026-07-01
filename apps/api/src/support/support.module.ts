import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { AI_DRAFT_GENERATOR, AiDraftService } from './ai-draft.service';
import { GeminiAiDraftGenerator } from './ai-draft-generator';
import { ChannelsController } from './channels.controller';
import { DrizzleSupportRepository } from './drizzle-support.repository';
import { InboxController } from './inbox.controller';
import { PublicWidgetController } from './public-widget.controller';
import { RateLimitService } from './rate-limit.service';
import { SUPPORT_REPOSITORY, SupportService } from './support.service';

@Module({
  controllers: [ChannelsController, InboxController, PublicWidgetController],
  imports: [AuthModule, KnowledgeModule, WorkspaceModule],
  providers: [
    AiDraftService,
    GeminiAiDraftGenerator,
    RateLimitService,
    SupportService,
    { provide: AI_DRAFT_GENERATOR, useExisting: GeminiAiDraftGenerator },
    { provide: SUPPORT_REPOSITORY, useClass: DrizzleSupportRepository },
  ],
})
export class SupportModule {}
