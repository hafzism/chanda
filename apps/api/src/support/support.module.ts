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
import { ChannelCredentialCipher } from './telegram/channel-credential-cipher';
import { DrizzleTelegramRepository } from './telegram/drizzle-telegram.repository';
import { TelegramBotApiService } from './telegram/telegram-bot-api.service';
import {
  PublicTelegramController,
  TelegramController,
} from './telegram/telegram.controller';
import {
  TELEGRAM_BOT_API,
  TELEGRAM_REPOSITORY,
  TelegramService,
} from './telegram/telegram.service';

@Module({
  controllers: [
    ChannelsController,
    InboxController,
    PublicTelegramController,
    PublicWidgetController,
    TelegramController,
  ],
  imports: [AuthModule, KnowledgeModule, WorkspaceModule],
  providers: [
    AiDraftService,
    ChannelCredentialCipher,
    GeminiAiDraftGenerator,
    RateLimitService,
    SupportService,
    TelegramBotApiService,
    TelegramService,
    { provide: AI_DRAFT_GENERATOR, useExisting: GeminiAiDraftGenerator },
    { provide: SUPPORT_REPOSITORY, useClass: DrizzleSupportRepository },
    { provide: TELEGRAM_BOT_API, useExisting: TelegramBotApiService },
    { provide: TELEGRAM_REPOSITORY, useClass: DrizzleTelegramRepository },
  ],
})
export class SupportModule {}
