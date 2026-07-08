import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentSession, SessionGuard } from '../auth/session.guard';
import type { SessionRecord } from '../auth/auth.types';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../workspaces/workspace-role.guard';
import { BillingService } from './billing.service';

@Controller('v1/workspaces/:workspaceId/billing')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  summary(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.billing.summary(workspaceId);
  }

  @Post('checkout')
  @WorkspaceRoles('owner')
  checkout(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.billing.createCheckout(workspaceId, session.user.email);
  }

  @Post('portal')
  @WorkspaceRoles('owner')
  portal(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.billing.createPortal(workspaceId);
  }
}

@Controller('v1/public/stripe')
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!request.rawBody || !signature)
      throw new BadRequestException(
        'Stripe webhook signature and raw body are required.',
      );
    return this.billing.handleWebhook(request.rawBody, signature);
  }
}
