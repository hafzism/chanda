import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { SessionGuard } from '../auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../workspaces/workspace-role.guard';
import { AnalyticsService } from './analytics.service';

@Controller('v1/workspaces/:workspaceId/analytics')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  overview(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.analyticsService.overview(workspaceId);
  }
}
