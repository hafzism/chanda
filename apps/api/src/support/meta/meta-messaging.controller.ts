import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';

import { SessionGuard } from '../../auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../../workspaces/workspace-role.guard';
import { ConnectMetaChannelDto } from '../dto/connect-meta-channel.dto';
import {
  MetaMessagingService,
  requireMetaKind,
} from './meta-messaging.service';

@Controller('v1/workspaces/:workspaceId/channels/meta/:kind')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class MetaMessagingController {
  constructor(private readonly meta: MetaMessagingService) {}

  @Get()
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  get(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('kind') kind: string,
  ) {
    return this.meta.getConnection(workspaceId, requireMetaKind(kind));
  }

  @Post()
  @WorkspaceRoles('owner', 'admin')
  connect(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('kind') kind: string,
    @Body() input: ConnectMetaChannelDto,
  ) {
    return this.meta.connect(workspaceId, requireMetaKind(kind), input);
  }

  @Delete()
  @HttpCode(204)
  @WorkspaceRoles('owner', 'admin')
  disconnect(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('kind') kind: string,
  ) {
    return this.meta.disconnect(workspaceId, requireMetaKind(kind));
  }
}

@Controller('v1/public/meta')
export class PublicMetaMessagingController {
  constructor(private readonly meta: MetaMessagingService) {}

  @Get(':kind/:connectionId/webhook')
  async verify(
    @Param('kind') kind: string,
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ) {
    const result = await this.meta.verifyWebhook(
      connectionId,
      requireMetaKind(kind),
      mode,
      token,
      challenge,
    );
    return response.status(200).send(result);
  }

  @Post(':kind/:connectionId/webhook')
  @HttpCode(200)
  webhook(
    @Param('kind') kind: string,
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
    @Body() payload: unknown,
  ) {
    return this.meta.ingest(
      connectionId,
      requireMetaKind(kind),
      signature,
      request.rawBody,
      payload,
    );
  }
}
