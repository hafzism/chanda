import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentSession, SessionGuard } from '../auth/session.guard';
import type { SessionRecord } from '../auth/auth.types';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../workspaces/workspace-role.guard';
import { AiConfigurationService } from './ai-configuration.service';
import { ConfigureAiProviderDto } from './dto/configure-ai-provider.dto';

@Controller('v1/workspaces/:workspaceId/ai-provider')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class AiConfigurationController {
  constructor(private readonly configurations: AiConfigurationService) {}

  @Get()
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  summary(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.configurations.summary(workspaceId);
  }

  @Put()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @WorkspaceRoles('owner', 'admin')
  configure(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
    @Body() input: ConfigureAiProviderDto,
  ) {
    return this.configurations.configure({
      apiKey: input.apiKey,
      configuredByUserId: session.user.id,
      provider: input.provider,
      workspaceId,
    });
  }

  @Delete()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceRoles('owner', 'admin')
  async remove(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<void> {
    await this.configurations.remove(workspaceId);
  }
}
