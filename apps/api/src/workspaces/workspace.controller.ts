import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentSession, SessionGuard } from '../auth/session.guard';
import type { SessionRecord } from '../auth/auth.types';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceService } from './workspace.service';

@Controller('v1/workspaces')
@UseGuards(SessionGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  list(@CurrentSession() session: SessionRecord) {
    return this.workspaceService.listForUser(session.user.id);
  }

  @Post()
  create(
    @CurrentSession() session: SessionRecord,
    @Body() input: CreateWorkspaceDto,
  ) {
    return this.workspaceService.create(session.user.id, input);
  }
}
