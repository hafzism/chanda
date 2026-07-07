import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import type { SessionRecord } from '../../auth/auth.types';
import { CurrentSession, SessionGuard } from '../../auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../../workspaces/workspace-role.guard';
import { GmailService } from './gmail.service';

@Controller('v1/workspaces/:workspaceId/channels/gmail')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class GmailController {
  constructor(private readonly gmail: GmailService) {}

  @Get()
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  get(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.gmail.getConnection(workspaceId);
  }

  @Post('oauth')
  @WorkspaceRoles('owner', 'admin')
  beginOAuth(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.gmail.beginOAuth(workspaceId, session.user.id);
  }

  @Post('sync')
  @WorkspaceRoles('owner', 'admin', 'agent')
  sync(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.gmail.sync(workspaceId);
  }

  @Delete()
  @HttpCode(204)
  @WorkspaceRoles('owner', 'admin')
  disconnect(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.gmail.disconnect(workspaceId);
  }
}

@Controller('v1/public/gmail/oauth')
export class PublicGmailOAuthController {
  constructor(private readonly gmail: GmailService) {}

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() response: Response,
  ) {
    if (oauthError) {
      return response.redirect(
        this.gmail.callbackUrl({
          message: 'Google authorization was cancelled.',
          success: false,
        }),
      );
    }
    try {
      await this.gmail.completeOAuth(code, state);
      return response.redirect(this.gmail.callbackUrl({ success: true }));
    } catch (error: unknown) {
      return response.redirect(
        this.gmail.callbackUrl({
          message:
            error instanceof Error ? error.message : 'Gmail connection failed.',
          success: false,
        }),
      );
    }
  }
}
