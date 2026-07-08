import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { AuthModule } from '../auth/auth.module';
import {
  BillingController,
  StripeWebhookController,
} from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController, StripeWebhookController],
  imports: [AuthModule, WorkspaceModule],
  providers: [BillingRepository, BillingService],
})
export class BillingModule {}
