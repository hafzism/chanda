import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DrizzleWorkspaceRepository } from './drizzle-workspace.repository';
import { WorkspaceController } from './workspace.controller';
import { WORKSPACE_REPOSITORY, WorkspaceService } from './workspace.service';

@Module({
  controllers: [WorkspaceController],
  imports: [AuthModule],
  providers: [
    WorkspaceService,
    { provide: WORKSPACE_REPOSITORY, useClass: DrizzleWorkspaceRepository },
  ],
})
export class WorkspaceModule {}
