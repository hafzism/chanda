import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateLimitService } from '../src/support/rate-limit.service';
import { SupportService } from '../src/support/support.service';
import type { SupportRepository } from '../src/support/support.types';

describe('SupportService', () => {
  const ingestMock = vi.fn<SupportRepository['ingestWidgetMessage']>();
  const findPolicyMock =
    vi.fn<SupportRepository['findWidgetConnectionPolicy']>();
  const getWebChannelMock = vi.fn<SupportRepository['getWebChannel']>();
  const updateOriginsMock = vi.fn<SupportRepository['updateWidgetOrigins']>();
  const consumeMock = vi.fn<RateLimitService['consumeWidgetMessage']>();
  let service: SupportService;

  beforeEach(() => {
    vi.clearAllMocks();
    consumeMock.mockResolvedValue(undefined);
    ingestMock.mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      ticketNumber: 1,
    });
    service = new SupportService(
      {
        findWidgetConnectionPolicy: findPolicyMock,
        getWebChannel: getWebChannelMock,
        ingestWidgetMessage: ingestMock,
        updateWidgetOrigins: updateOriginsMock,
      },
      { consumeWidgetMessage: consumeMock } as unknown as RateLimitService,
    );
  });

  it('normalizes and rate-limits a public widget message', async () => {
    await expect(
      service.ingestWidgetMessage('pub_123456789012345678901234', '127.0.0.1', {
        body: '  Where is my order?  ',
        displayName: '  Riyas  ',
        email: 'RIYAS@example.com',
        messageId: 'af36c7f9-327b-49c3-a796-e14707a1b62f',
        threadId: '6d490022-6c36-4d7a-aa2d-cf99f4927e03',
        visitorId: '0cb70bc7-eb27-437f-9587-06a3e4f801a8',
      }),
    ).resolves.toMatchObject({ ticketNumber: 1 });
    expect(consumeMock).toHaveBeenCalledOnce();
    expect(ingestMock.mock.calls[0]?.[0]).toMatchObject({
      body: 'Where is my order?',
      displayName: 'Riyas',
      email: 'riyas@example.com',
    });
  });

  it('does not query storage for malformed public keys', async () => {
    await expect(
      service.ingestWidgetMessage('invalid', '127.0.0.1', {
        body: 'Hello',
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
});
