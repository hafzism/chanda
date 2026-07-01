import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Options,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { IngestWidgetMessageDto } from './dto/ingest-widget-message.dto';
import { SupportService } from './support.service';

@Controller('v1/public/widget')
export class PublicWidgetController {
  constructor(private readonly support: SupportService) {}

  @Post(':publicKey/messages')
  async ingest(
    @Param('publicKey') publicKey: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('origin') origin: string | undefined,
    @Body() input: IngestWidgetMessageDto,
  ) {
    const result = await this.support.ingestWidgetMessage(
      publicKey,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
      input,
      origin,
    );
    if (origin) setCorsResponse(response, origin);
    return result;
  }

  @Options(':publicKey/messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  async preflight(
    @Param('publicKey') publicKey: string,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (!origin) throw new BadRequestException('Origin header is required.');
    await this.support.assertWidgetOrigin(publicKey, origin);
    setCorsResponse(response, origin);
  }

  @Get(':publicKey/conversations/:threadId/messages')
  async readConversation(
    @Param('publicKey') publicKey: string,
    @Param('threadId') threadId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('authorization') authorization: string | undefined,
    @Headers('origin') origin: string | undefined,
  ) {
    const token = readBearerToken(authorization);
    const result = await this.support.readWidgetConversation(
      publicKey,
      threadId,
      token,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
      origin,
    );
    if (origin) setCorsResponse(response, origin);
    return result;
  }

  @Options(':publicKey/conversations/:threadId/messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  async preflightConversation(
    @Param('publicKey') publicKey: string,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (!origin) throw new BadRequestException('Origin header is required.');
    await this.support.assertWidgetOrigin(publicKey, origin);
    setCorsResponse(response, origin);
  }
}

function readBearerToken(value: string | undefined): string {
  const match = value?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  const token = match?.[1];
  if (!token)
    throw new BadRequestException('A conversation token is required.');
  return token;
}

function setCorsResponse(response: Response, origin: string): void {
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Vary', 'Origin');
}
