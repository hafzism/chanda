import { createHash, createHmac } from 'node:crypto';

/* eslint-disable @typescript-eslint/unbound-method -- interface mocks are intentionally asserted as detached Vitest functions */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MetaMessagingService,
  parseMetaMessagingWebhook,
} from '../src/support/meta/meta-messaging.service';
import type {
  MetaMessagingApi,
  MetaMessagingRepository,
} from '../src/support/meta/meta-messaging.types';
import { ChannelCredentialCipher } from '../src/support/telegram/channel-credential-cipher';

describe('MetaMessagingService', () => {
  let api: MetaMessagingApi;
  let cipher: ChannelCredentialCipher;
  let repository: MetaMessagingRepository;
  let service: MetaMessagingService;

  beforeEach(() => {
    cipher = new ChannelCredentialCipher(
      new ConfigService({
        CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          'base64',
        ),
      }),
    );
    api = {
      getAsset: vi.fn().mockResolvedValue({
        id: 'page-1',
        name: 'Suppline Page',
        username: null,
      }),
      sendText: vi.fn().mockResolvedValue({ messageId: 'm_mid.sent-1' }),
    };
    repository = {
      disconnect: vi.fn(),
      findConnection: vi.fn().mockResolvedValue(null),
      findDeliveryContext: vi.fn(),
      findWebhookCredential: vi.fn(),
      ingest: vi.fn(),
      markDelivered: vi.fn().mockResolvedValue(undefined),
      markWebhookVerified: vi.fn().mockResolvedValue(undefined),
      saveConnection: vi
        .fn<MetaMessagingRepository['saveConnection']>()
        .mockImplementation((input) =>
          Promise.resolve({
            assetId: input.asset.id,
            assetName: input.asset.name,
            id: input.connectionId,
            kind: input.kind,
            lastInboundAt: null,
            name: input.asset.name,
            status: 'active',
            username: input.asset.username,
            webhookUrl: input.webhookUrl,
            webhookVerifiedAt: null,
          }),
        ),
    };
    service = new MetaMessagingService(
      repository,
      api,
      cipher,
      new ConfigService({
        META_MESSAGING_WEBHOOK_BASE_URL: 'https://api.suppline.example',
      }),
    );
  });

  it('verifies a Page and returns a one-time hashed webhook token', async () => {
    const result = await service.connect('workspace-1', 'facebook', {
      appSecret: 'a'.repeat(32),
      assetId: 'page-1',
      pageAccessToken: 'page-access-token',
    });
    const saved = vi.mocked(repository.saveConnection).mock.calls[0]?.[0];

    expect(result.verifyToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(saved?.webhookSecretHash).toBe(
      createHash('sha256').update(result.verifyToken).digest('hex'),
    );
    expect(saved?.encryptedCredentials).not.toContain('page-access-token');
    expect(saved?.webhookUrl).toContain('/v1/public/meta/facebook/');
  });

  it('rejects an invalid signature before webhook ingestion', async () => {
    vi.mocked(repository.findWebhookCredential).mockResolvedValue({
      assetId: 'page-1',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({
          appSecret: 'a'.repeat(32),
          pageAccessToken: 'page-token',
        }),
      ),
      webhookSecretHash: 'unused',
    });

    await expect(
      service.ingest(
        'connection-1',
        'facebook',
        `sha256=${'0'.repeat(64)}`,
        Buffer.from('{}'),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('normalizes a signed Facebook message and delivery receipt', async () => {
    const payload = messengerPayload();
    const rawBody = Buffer.from(JSON.stringify(payload));
    const appSecret = 'a'.repeat(32);
    vi.mocked(repository.findWebhookCredential).mockResolvedValue({
      assetId: 'page-1',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ appSecret, pageAccessToken: 'page-token' }),
      ),
      webhookSecretHash: 'unused',
    });
    vi.mocked(repository.ingest).mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      ticketNumber: 1,
    });
    const signature = `sha256=${createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    await service.ingest(
      'connection-1',
      'facebook',
      signature,
      rawBody,
      payload,
    );

    expect(repository.ingest).toHaveBeenCalledWith(
      'connection-1',
      'facebook',
      expect.objectContaining({
        body: 'Where is my order?',
        externalMessageId: 'm_mid.inbound-1',
        senderId: 'psid-1',
      }),
    );
    expect(repository.markDelivered).toHaveBeenCalledWith(
      'connection-1',
      'm_mid.sent-1',
      expect.any(Date),
    );
  });

  it('enforces the standard 24-hour response window', async () => {
    vi.mocked(repository.findDeliveryContext).mockResolvedValue({
      assetId: 'page-1',
      channel: 'facebook',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({
          appSecret: 'a'.repeat(32),
          pageAccessToken: 'page-token',
        }),
      ),
      lastInboundAt: new Date(Date.now() - 25 * 60 * 60_000),
      recipientId: 'psid-1',
    });

    await expect(
      service.deliverReply('workspace-1', 'conversation-1', 'Too late'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(api.sendText).not.toHaveBeenCalled();
  });
});

describe('parseMetaMessagingWebhook', () => {
  it('ignores echoes, wrong objects, and events for another Page', () => {
    expect(parseMetaMessagingWebhook({}, 'facebook', 'page-1')).toEqual({
      deliveries: [],
      messages: [],
    });
    expect(
      parseMetaMessagingWebhook(messengerPayload(), 'facebook', 'page-2'),
    ).toEqual({ deliveries: [], messages: [] });
  });
});

function messengerPayload() {
  return {
    entry: [
      {
        id: 'page-1',
        messaging: [
          {
            message: {
              mid: 'm_mid.inbound-1',
              text: ' Where is my order? ',
            },
            recipient: { id: 'page-1' },
            sender: { id: 'psid-1' },
            timestamp: 1_783_980_000_000,
          },
          {
            delivery: { mids: ['m_mid.sent-1'] },
            recipient: { id: 'page-1' },
            sender: { id: 'psid-1' },
            timestamp: 1_783_980_001_000,
          },
        ],
      },
    ],
    object: 'page',
  };
}
