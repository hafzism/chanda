import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { SessionRecord } from '../auth/auth.types';
import { CurrentSession, SessionGuard } from '../auth/session.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { WorkspaceRoleGuard, WorkspaceRoles } from './workspace-role.guard';
import { WorkspaceService } from './workspace.service';

@Controller('v1/workspaces/:workspaceId/team')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
@WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
export class TeamController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get()
  list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.workspaces.listTeam(workspaceId, session.user.id);
  }

  @Post('invitations')
  @WorkspaceRoles('owner', 'admin')
  createInvitation(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
    @Body() input: CreateInvitationDto,
  ) {
    return this.workspaces.createInvitation(
      workspaceId,
      session.user.id,
      input.email,
      input.role,
    );
  }

  @Delete('invitations/:invitationId')
  @WorkspaceRoles('owner', 'admin')
  revokeInvitation(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.workspaces.revokeInvitation(
      workspaceId,
      invitationId,
      session.user.id,
    );
  }

  @Patch('members/:userId')
  @WorkspaceRoles('owner')
  updateMemberRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: SessionRecord,
    @Body() input: UpdateMemberRoleDto,
  ) {
    return this.workspaces.updateMemberRole(
      workspaceId,
      userId,
      input.role,
      session.user.id,
    );
  }

  @Delete('members/:userId')
  @WorkspaceRoles('owner', 'admin')
  removeMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.workspaces.removeMember(workspaceId, userId, session.user.id);
  }
}
