import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateLimitService } from '../src/support/rate-limit.service';
import type { GmailService } from '../src/support/gmail/gmail.service';
import type { MetaMessagingService } from '../src/support/meta/meta-messaging.service';
import { SupportService } from '../src/support/support.service';
import type { SupportRepository } from '../src/support/support.types';
import type { TelegramService } from '../src/support/telegram/telegram.service';
import type { WhatsAppService } from '../src/support/whatsapp/whatsapp.service';

describe('SupportService', () => {
  const ingestMock = vi.fn<SupportRepository['ingestWidgetMessage']>();
  const addInboxNoteMock = vi.fn<SupportRepository['addInboxNote']>();
  const findPolicyMock =
    vi.fn<SupportRepository['findWidgetConnectionPolicy']>();
  const getInboxConversationMock =
    vi.fn<SupportRepository['getInboxConversation']>();
  const getAiDraftContextMock = vi.fn<SupportRepository['getAiDraftContext']>();
  const getWebChannelMock = vi.fn<SupportRepository['getWebChannel']>();
  const listInboxMock = vi.fn<SupportRepository['listInbox']>();
  const readWidgetConversationMock =
    vi.fn<SupportRepository['readWidgetConversation']>();
  const sendInboxReplyMock = vi.fn<SupportRepository['sendInboxReply']>();
  const saveAiDraftMock = vi.fn<SupportRepository['saveAiDraft']>();
  const updateTicketMock = vi.fn<SupportRepository['updateTicket']>();
  const updateOriginsMock = vi.fn<SupportRepository['updateWidgetOrigins']>();
  const consumeMock = vi.fn<RateLimitService['consumeWidgetMessage']>();
  const consumeReadMock = vi.fn<RateLimitService['consumeWidgetRead']>();
  let service: SupportService;

  beforeEach(() => {
    vi.clearAllMocks();
    consumeMock.mockResolvedValue(undefined);
    consumeReadMock.mockResolvedValue(undefined);
    ingestMock.mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      ticketNumber: 1,
    });
    service = new SupportService(
      {
        addInboxNote: addInboxNoteMock,
        findWidgetConnectionPolicy: findPolicyMock,
        getInboxConversation: getInboxConversationMock,
        getAiDraftContext: getAiDraftContextMock,
        getWebChannel: getWebChannelMock,
        ingestWidgetMessage: ingestMock,
        listInbox: listInboxMock,
        readWidgetConversation: readWidgetConversationMock,
        saveAiDraft: saveAiDraftMock,
        sendInboxReply: sendInboxReplyMock,
        updateTicket: updateTicketMock,
        updateWidgetOrigins: updateOriginsMock,
      },
      {
        consumeWidgetMessage: consumeMock,
        consumeWidgetRead: consumeReadMock,
      } as unknown as RateLimitService,
      {
        deliverReply: vi.fn().mockResolvedValue(undefined),
      } as unknown as TelegramService,
      {
        deliverReply: vi.fn().mockResolvedValue(undefined),
      } as unknown as GmailService,
      {
        deliverReply: vi.fn().mockResolvedValue(undefined),
      } as unknown as WhatsAppService,
      {
        deliverReply: vi.fn().mockResolvedValue(undefined),
      } as unknown as MetaMessagingService,
    );
  });

  it('normalizes and rate-limits a public widget message', async () => {
    await expect(
      service.ingestWidgetMessage('pub_123456789012345678901234', '127.0.0.1', {
        body: '  Where is my order?  ',
        conversationToken: 'a'.repeat(43),
        displayName: '  Riyas  ',
        email: 'RIYAS@example.com',
        messageId: 'af36c7f9-327b-49c3-a796-e14707a1b62f',
        threadId: '6d490022-6c36-4d7a-aa2d-cf99f4927e03',
        visitorId: '0cb70bc7-eb27-437f-9587-06a3e4f801a8',
      }),
    ).resolves.toMatchObject({ ticketNumber: 1 });
    expect(consumeMock).toHaveBeenCalledOnce();
    const storedInput = ingestMock.mock.calls[0]?.[0];
    expect(storedInput).toMatchObject({
      body: 'Where is my order?',
      displayName: 'Riyas',
      email: 'riyas@example.com',
    });
    expect(storedInput?.publicAccessTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not query storage for malformed public keys', async () => {
    await expect(
      service.ingestWidgetMessage('invalid', '127.0.0.1', {
        body: 'Hello',
        conversationToken: 'a'.repeat(43),
        messageId: 'af36c7f9-327b-49c3-a796-e14707a1b62f',
        threadId: '6d490022-6c36-4d7a-aa2d-cf99f4927e03',
        visitorId: '0cb70bc7-eb27-437f-9587-06a3e4f801a8',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it('retries once after a concurrent identity conflict', async () => {
    ingestMock
      .mockRejectedValueOnce(
        Object.assign(new Error('duplicate'), { code: '23505' }),
      )
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        messageId: 'message-1',
        ticketNumber: 1,
      });

    await service.ingestWidgetMessage(
      'pub_123456789012345678901234',
      '127.0.0.1',
      {
        body: 'Hello',
        conversationToken: 'a'.repeat(43),
        messageId: 'af36c7f9-327b-49c3-a796-e14707a1b62f',
        threadId: '6d490022-6c36-4d7a-aa2d-cf99f4927e03',
        visitorId: '0cb70bc7-eb27-437f-9587-06a3e4f801a8',
      },
    );

    expect(ingestMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes and deduplicates configured widget origins', async () => {
    updateOriginsMock.mockImplementation((_workspaceId, origins) =>
      Promise.resolve({
        allowedOrigins: origins,
        id: 'channel-1',
        lastInboundAt: null,
        name: 'Website chat',
        publicKey: 'pub_123456789012345678901234',
        status: 'active',
      }),
    );

    await expect(
      service.updateWidgetOrigins('workspace-1', [
        'https://support.example.com/',
        'http://localhost:3000',
        'https://support.example.com',
      ]),
    ).resolves.toMatchObject({
      allowedOrigins: ['http://localhost:3000', 'https://support.example.com'],
    });
  });

  it('rejects origins containing paths or credentials', async () => {
    await expect(
      service.updateWidgetOrigins('workspace-1', [
        'https://user@example.com/widget',
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateOriginsMock).not.toHaveBeenCalled();
  });

  it('allows only configured browser origins', async () => {
    findPolicyMock.mockResolvedValue({
      allowedOrigins: ['https://store.example.com'],
    });

    await expect(
      service.assertWidgetOrigin(
        'pub_123456789012345678901234',
        'https://store.example.com',
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertWidgetOrigin(
        'pub_123456789012345678901234',
        'https://attacker.example.com',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal missing or cross-workspace conversations', async () => {
    getInboxConversationMock.mockResolvedValue(null);

    await expect(
      service.getInboxConversation('workspace-1', 'conversation-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a valid capability before reading a widget conversation', async () => {
    await expect(
      service.readWidgetConversation(
        'pub_123456789012345678901234',
        'thread-1',
        'invalid',
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(consumeReadMock).not.toHaveBeenCalled();
    expect(readWidgetConversationMock).not.toHaveBeenCalled();
  });

  it('normalizes replies and rejects empty ticket updates', async () => {
    sendInboxReplyMock.mockResolvedValue({
      authorKind: 'agent',
      body: 'Thanks for contacting us.',
      direction: 'outbound',
      id: 'message-1',
      occurredAt: new Date(),
    });

    await service.sendInboxReply(
      'workspace-1',
      'conversation-1',
      'user-1',
      '  Thanks for contacting us.  ',
    );
    expect(sendInboxReplyMock).toHaveBeenCalledWith(
      'workspace-1',
      'conversation-1',
      'user-1',
      'Thanks for contacting us.',
      undefined,
      undefined,
    );
    await expect(
      service.updateTicket('workspace-1', 'conversation-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateTicketMock).not.toHaveBeenCalled();
  });
});
