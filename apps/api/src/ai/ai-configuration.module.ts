import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { AiConfigurationController } from './ai-configuration.controller';
import {
  AI_CONFIGURATION_REPOSITORY,
  AiConfigurationService,
} from './ai-configuration.service';
import { AiCredentialCipherService } from './ai-credential-cipher.service';
import { AiProviderClientFactory } from './ai-provider-client.factory';
import { DrizzleAiConfigurationRepository } from './drizzle-ai-configuration.repository';

@Module({
  controllers: [AiConfigurationController],
  exports: [AiConfigurationService],
  imports: [AuthModule, WorkspaceModule],
  providers: [
    AiConfigurationService,
    AiCredentialCipherService,
    AiProviderClientFactory,
    DrizzleAiConfigurationRepository,
    {
      provide: AI_CONFIGURATION_REPOSITORY,
      useExisting: DrizzleAiConfigurationRepository,
    },
  ],
})
export class AiConfigurationModule {}
