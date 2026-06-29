import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { ChannelsController } from './channels.controller';
import { DrizzleSupportRepository } from './drizzle-support.repository';
import { PublicWidgetController } from './public-widget.controller';
import { RateLimitService } from './rate-limit.service';
import { SUPPORT_REPOSITORY, SupportService } from './support.service';

@Module({
  controllers: [ChannelsController, PublicWidgetController],
  imports: [AuthModule, WorkspaceModule],
  providers: [
    RateLimitService,
    SupportService,
    { provide: SUPPORT_REPOSITORY, useClass: DrizzleSupportRepository },
  ],
})
export class SupportModule {}
