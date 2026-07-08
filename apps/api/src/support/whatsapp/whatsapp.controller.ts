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
import { ConnectWhatsAppDto } from '../dto/connect-whatsapp.dto';
import { WhatsAppService } from './whatsapp.service';

@Controller('v1/workspaces/:workspaceId/channels/whatsapp')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  get(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.whatsapp.getConnection(workspaceId);
  }

  @Post()
  @WorkspaceRoles('owner', 'admin')
  connect(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() input: ConnectWhatsAppDto,
  ) {
    return this.whatsapp.connect(workspaceId, input);
  }

  @Delete()
  @HttpCode(204)
  @WorkspaceRoles('owner', 'admin')
  disconnect(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.whatsapp.disconnect(workspaceId);
  }
}

@Controller('v1/public/whatsapp')
export class PublicWhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get(':connectionId/webhook')
  async verify(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ) {
    const result = await this.whatsapp.verifyWebhook(
      connectionId,
      mode,
      token,
      challenge,
    );
    return response.status(200).send(result);
  }

  @Post(':connectionId/webhook')
  @HttpCode(200)
  webhook(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
    @Body() payload: unknown,
  ) {
    return this.whatsapp.ingest(
      connectionId,
      signature,
      request.rawBody,
      payload,
    );
  }
}
