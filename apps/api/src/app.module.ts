import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { WorkspaceModule } from './workspaces/workspace.module';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspaceModule],
  controllers: [HealthController],
})
export class AppModule {}
