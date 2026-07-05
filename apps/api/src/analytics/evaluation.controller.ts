import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { SessionRecord } from '../auth/auth.types';
import { CurrentSession, SessionGuard } from '../auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../workspaces/workspace-role.guard';
import { CreateEvaluationCaseDto } from './dto/create-evaluation-case.dto';
import { EvaluationService } from './evaluation.service';

@Controller('v1/workspaces/:workspaceId/analytics/evaluations')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
@WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
export class EvaluationController {
  constructor(private readonly evaluations: EvaluationService) {}

  @Get('cases')
  listCases(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.evaluations.listCases(workspaceId);
  }

  @Post('cases')
  @WorkspaceRoles('owner', 'admin')
  createCase(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
    @Body() input: CreateEvaluationCaseDto,
  ) {
    return this.evaluations.createCase(workspaceId, session.user.id, input);
  }

  @Delete('cases/:caseId')
  @HttpCode(204)
  @WorkspaceRoles('owner', 'admin')
  deleteCase(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    return this.evaluations.deleteCase(workspaceId, caseId);
  }

  @Get('runs')
  listRuns(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.evaluations.listRuns(workspaceId);
  }

  @Post('runs')
  @WorkspaceRoles('owner', 'admin')
  run(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.evaluations.run(workspaceId, session.user.id);
  }
}
