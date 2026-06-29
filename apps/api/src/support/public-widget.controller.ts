import {
  BadRequestException,
  Body,
  Controller,
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
}

function setCorsResponse(response: Response, origin: string): void {
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Vary', 'Origin');
}
