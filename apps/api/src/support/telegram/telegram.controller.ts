import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { SessionGuard } from '../../auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../../workspaces/workspace-role.guard';
import { ConnectTelegramDto } from '../dto/connect-telegram.dto';
import { TelegramService } from './telegram.service';

@Controller('v1/workspaces/:workspaceId/channels/telegram')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Get()
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  get(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.telegram.getConnection(workspaceId);
  }

  @Post()
  @WorkspaceRoles('owner', 'admin')
  connect(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() input: ConnectTelegramDto,
  ) {
    return this.telegram.connect(workspaceId, input.botToken);
  }

  @Delete()
  @HttpCode(204)
  @WorkspaceRoles('owner', 'admin')
  disconnect(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.telegram.disconnect(workspaceId);
  }
}

@Controller('v1/public/telegram')
export class PublicTelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post(':connectionId/webhook')
  @HttpCode(200)
  webhook(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() payload: unknown,
  ) {
    return this.telegram.ingest(connectionId, secret, payload);
  }
}
