import { createHash } from 'node:crypto';

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
  InboxConversationDetail,
  InboxConversationSummary,
  InboxMessage,
  InboxNote,
  SupportRepository,
  TicketUpdate,
  WebChannelSummary,
  WidgetConversationRead,
  WidgetMessageResult,
} from './support.types';
import { TelegramService } from './telegram/telegram.service';

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
    private readonly telegram: TelegramService,
  ) {}

  listInbox(workspaceId: string): Promise<InboxConversationSummary[]> {
    return this.repository.listInbox(workspaceId);
  }

  async getInboxConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<InboxConversationDetail> {
    const conversation = await this.repository.getInboxConversation(
      workspaceId,
      conversationId,
    );
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  async addInboxNote(
    workspaceId: string,
    conversationId: string,
    userId: string,
    body: string,
  ): Promise<InboxNote> {
    const note = await this.repository.addInboxNote(
      workspaceId,
      conversationId,
      userId,
      requireMeaningfulBody(body),
    );
    if (!note) throw new NotFoundException('Conversation not found.');
    return note;
  }

  async sendInboxReply(
    workspaceId: string,
    conversationId: string,
    userId: string,
    body: string,
    draftId?: string,
  ): Promise<InboxMessage> {
    const normalizedBody = requireMeaningfulBody(body);
    const externalMessageId = await this.telegram.deliverReply(
      workspaceId,
      conversationId,
      normalizedBody,
      draftId,
    );
    const message = await this.repository.sendInboxReply(
      workspaceId,
      conversationId,
      userId,
      normalizedBody,
      draftId,
      externalMessageId,
    );
    if (!message) throw new NotFoundException('Conversation not found.');
    return message;
  }

  async updateTicket(
    workspaceId: string,
    conversationId: string,
    input: TicketUpdate,
  ): Promise<InboxConversationSummary> {
    if (!input.status && !input.priority) {
      throw new BadRequestException('A status or priority is required.');
    }
    const ticket = await this.repository.updateTicket(
      workspaceId,
      conversationId,
      input,
    );
    if (!ticket) throw new NotFoundException('Conversation not found.');
    return ticket;
  }

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

  async readWidgetConversation(
    publicKey: string,
    threadId: string,
    token: string,
    ipAddress: string,
    origin?: string,
  ): Promise<WidgetConversationRead> {
    if (!/^pub_[A-Za-z0-9_-]{24,64}$/.test(publicKey)) {
      throw new NotFoundException('Web chat connection not found.');
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('Conversation not found.');
    }
    if (origin) await this.assertWidgetOrigin(publicKey, origin);
    await this.rateLimit.consumeWidgetRead(publicKey, ipAddress);
    const conversation = await this.repository.readWidgetConversation(
      publicKey,
      threadId,
      hashCapability(token),
    );
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
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
      publicAccessTokenHash: hashCapability(input.conversationToken),
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

function hashCapability(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireMeaningfulBody(value: string): string {
  const body = value.trim();
  if (!body) throw new BadRequestException('Message body cannot be empty.');
  return body;
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
