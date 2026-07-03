import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import type { SessionRecord } from '../auth/auth.types';
import { CurrentSession, SessionGuard } from '../auth/session.guard';
import { WorkspaceService } from './workspace.service';

@Controller('v1/invitations')
@UseGuards(SessionGuard)
export class InvitationController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get(':token')
  preview(
    @Param('token') token: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.workspaces.previewInvitation(token, session.user.email);
  }

  @Post(':token/accept')
  accept(
    @Param('token') token: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.workspaces.acceptInvitation(
      token,
      session.user.id,
      session.user.email,
    );
  }
}
