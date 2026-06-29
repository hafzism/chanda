import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { IngestWidgetMessageDto } from './dto/ingest-widget-message.dto';
import { RateLimitService } from './rate-limit.service';
import type {
  SupportRepository,
  WebChannelSummary,
  WidgetMessageResult,
} from './support.types';

export const SUPPORT_REPOSITORY = Symbol('SUPPORT_REPOSITORY');

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

@Injectable()
export class SupportService {
  constructor(
    @Inject(SUPPORT_REPOSITORY)
    private readonly repository: SupportRepository,
    private readonly rateLimit: RateLimitService,
  ) {}

  async getWebChannel(workspaceId: string): Promise<WebChannelSummary> {
    const channel = await this.repository.getWebChannel(workspaceId);
    if (!channel) throw new NotFoundException('Web chat connection not found.');
    return channel;
  }

  async updateWidgetOrigins(
    workspaceId: string,
    origins: string[],
  ): Promise<WebChannelSummary> {
    const normalized = [...new Set(origins.map(normalizeOrigin))].sort();
    const channel = await this.repository.updateWidgetOrigins(
      workspaceId,
      normalized,
    );
    if (!channel) throw new NotFoundException('Web chat connection not found.');
    return channel;
  }

  async assertWidgetOrigin(publicKey: string, origin: string): Promise<void> {
    const policy = await this.repository.findWidgetConnectionPolicy(publicKey);
    if (!policy) throw new NotFoundException('Web chat connection not found.');
    if (!policy.allowedOrigins.includes(origin)) {
      throw new ForbiddenException(
        'This website is not allowed to use the widget.',
      );
    }
  }

  async ingestWidgetMessage(
    publicKey: string,
    ipAddress: string,
    input: IngestWidgetMessageDto,
    origin?: string,
  ): Promise<WidgetMessageResult> {
    if (!/^pub_[A-Za-z0-9_-]{24,64}$/.test(publicKey)) {
      throw new NotFoundException('Web chat connection not found.');
    }
    if (origin) await this.assertWidgetOrigin(publicKey, origin);
    await this.rateLimit.consumeWidgetMessage(publicKey, ipAddress);

    const record = {
      body: input.body.trim(),
      displayName: input.displayName?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      externalMessageId: input.messageId,
      externalThreadId: input.threadId,
      externalVisitorId: input.visitorId,
      publicKey,
    };
    let result: WidgetMessageResult | null;
    try {
      result = await this.repository.ingestWidgetMessage(record);
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;
      result = await this.repository.ingestWidgetMessage(record);
    }
    if (!result) throw new NotFoundException('Web chat connection not found.');
    return result;
  }
}

function normalizeOrigin(value: string): string {
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('invalid origin');
    }
    return url.origin;
  } catch {
    throw new BadRequestException(
      'Each widget origin must contain only an http(s) scheme, host, and optional port.',
    );
  }
}
