import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository';
import { InvitationController } from './invitation.controller';
import { TeamController } from './team.controller';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceRoleGuard } from './workspace-role.guard';
import { WORKSPACE_REPOSITORY, WorkspaceService } from './workspace.service';

@Module({
  controllers: [InvitationController, TeamController, WorkspaceController],
  imports: [AuthModule],
  providers: [
    WorkspaceService,
    WorkspaceRoleGuard,
    { provide: WORKSPACE_REPOSITORY, useClass: DrizzleWorkspaceRepository },
  ],
  exports: [WorkspaceRoleGuard, WorkspaceService],
})
export class WorkspaceModule {}
