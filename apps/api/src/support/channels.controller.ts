import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { SessionGuard } from '../auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../workspaces/workspace-role.guard';
import { UpdateWidgetOriginsDto } from './dto/update-widget-origins.dto';
import { SupportService } from './support.service';

@Controller('v1/workspaces/:workspaceId/channels')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class ChannelsController {
  constructor(private readonly support: SupportService) {}

  @Get('web')
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  getWebChannel(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.support.getWebChannel(workspaceId);
  }

  @Patch('web/origins')
  @WorkspaceRoles('owner', 'admin')
  updateWidgetOrigins(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() input: UpdateWidgetOriginsDto,
  ) {
    return this.support.updateWidgetOrigins(workspaceId, input.origins);
  }
}
