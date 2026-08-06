import { Module } from '@nestjs/common';

import { AiConfigurationModule } from '../ai/ai-configuration.module';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { AI_DRAFT_GENERATOR, AiDraftService } from './ai-draft.service';
import { WorkspaceAiDraftGenerator } from './ai-draft-generator';
import { ChannelsController } from './channels.controller';
import { DrizzleSupportRepository } from './drizzle-support.repository';
import { DrizzleGmailRepository } from './gmail/drizzle-gmail.repository';
import { GmailApiService } from './gmail/gmail-api.service';
import {
  GmailController,
  PublicGmailOAuthController,
} from './gmail/gmail.controller';
import {
  GMAIL_API,
  GMAIL_REPOSITORY,
  GmailService,
} from './gmail/gmail.service';
import { InboxController } from './inbox.controller';
import { DrizzleMetaMessagingRepository } from './meta/drizzle-meta-messaging.repository';
import { MetaMessagingApiService } from './meta/meta-messaging-api.service';
import {
  MetaMessagingController,
  PublicMetaMessagingController,
} from './meta/meta-messaging.controller';
import {
  META_MESSAGING_API,
  META_MESSAGING_REPOSITORY,
  MetaMessagingService,
} from './meta/meta-messaging.service';
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
import { DrizzleWhatsAppRepository } from './whatsapp/drizzle-whatsapp.repository';
import { WhatsAppCloudApiService } from './whatsapp/whatsapp-api.service';
import {
  PublicWhatsAppController,
  WhatsAppController,
} from './whatsapp/whatsapp.controller';
import {
  WHATSAPP_API,
  WHATSAPP_REPOSITORY,
  WhatsAppService,
} from './whatsapp/whatsapp.service';

@Module({
  controllers: [
    ChannelsController,
    GmailController,
    InboxController,
    MetaMessagingController,
    PublicMetaMessagingController,
    PublicGmailOAuthController,
    PublicTelegramController,
    PublicWhatsAppController,
    PublicWidgetController,
    TelegramController,
    WhatsAppController,
  ],
  imports: [
    AiConfigurationModule,
    AuthModule,
    KnowledgeModule,
    WorkspaceModule,
  ],
  providers: [
    AiDraftService,
    ChannelCredentialCipher,
    WorkspaceAiDraftGenerator,
    GmailApiService,
    GmailService,
    MetaMessagingApiService,
    MetaMessagingService,
    RateLimitService,
    SupportService,
    TelegramBotApiService,
    TelegramService,
    WhatsAppCloudApiService,
    WhatsAppService,
    { provide: AI_DRAFT_GENERATOR, useExisting: WorkspaceAiDraftGenerator },
    { provide: GMAIL_API, useExisting: GmailApiService },
    { provide: GMAIL_REPOSITORY, useClass: DrizzleGmailRepository },
    { provide: META_MESSAGING_API, useExisting: MetaMessagingApiService },
    {
      provide: META_MESSAGING_REPOSITORY,
      useClass: DrizzleMetaMessagingRepository,
    },
    { provide: SUPPORT_REPOSITORY, useClass: DrizzleSupportRepository },
    { provide: TELEGRAM_BOT_API, useExisting: TelegramBotApiService },
    { provide: TELEGRAM_REPOSITORY, useClass: DrizzleTelegramRepository },
    { provide: WHATSAPP_API, useExisting: WhatsAppCloudApiService },
    { provide: WHATSAPP_REPOSITORY, useClass: DrizzleWhatsAppRepository },
  ],
})
export class SupportModule {}
