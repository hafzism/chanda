import { createHash, createHmac } from 'node:crypto';

/* eslint-disable @typescript-eslint/unbound-method -- interface mocks are intentionally asserted as detached Vitest functions */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChannelCredentialCipher } from '../src/support/telegram/channel-credential-cipher';
import {
  parseWhatsAppWebhook,
  WhatsAppService,
} from '../src/support/whatsapp/whatsapp.service';
import type {
  WhatsAppApi,
  WhatsAppRepository,
} from '../src/support/whatsapp/whatsapp.types';

describe('WhatsAppService', () => {
  let api: WhatsAppApi;
  let cipher: ChannelCredentialCipher;
  let repository: WhatsAppRepository;
  let service: WhatsAppService;

  beforeEach(() => {
    cipher = new ChannelCredentialCipher(
      new ConfigService({
        CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          'base64',
        ),
      }),
    );
    api = {
      getPhone: vi.fn().mockResolvedValue({
        displayPhoneNumber: '+1 555 0100',
        id: '123456789',
        verifiedName: 'Chanda Test',
      }),
      sendText: vi.fn().mockResolvedValue({ messageId: 'wamid.sent-1' }),
    };
    repository = {
      disconnect: vi.fn(),
      findConnection: vi.fn().mockResolvedValue(null),
      findDeliveryContext: vi.fn(),
      findWebhookCredential: vi.fn(),
      ingest: vi.fn(),
      markDeliveryStatus: vi.fn().mockResolvedValue(undefined),
      markWebhookVerified: vi.fn().mockResolvedValue(undefined),
      saveConnection: vi
        .fn<WhatsAppRepository['saveConnection']>()
        .mockImplementation((input) =>
          Promise.resolve({
            displayPhoneNumber: input.phone.displayPhoneNumber,
            id: input.connectionId,
            lastInboundAt: null,
            name: input.phone.verifiedName,
            phoneNumberId: input.phone.id,
            status: 'active',
            verifiedName: input.phone.verifiedName,
            webhookUrl: input.webhookUrl,
            webhookVerifiedAt: null,
          }),
        ),
    };
    service = new WhatsAppService(
      repository,
      api,
      cipher,
      new ConfigService({
        WHATSAPP_WEBHOOK_BASE_URL: 'https://api.suppline.example',
      }),
    );
  });

  it('verifies Meta credentials and returns a one-time webhook token', async () => {
    const result = await service.connect('workspace-1', {
      accessToken: 'meta-access-token',
      appSecret: 'a'.repeat(32),
      phoneNumberId: '123456789',
    });
    const saved = vi.mocked(repository.saveConnection).mock.calls[0]?.[0];

    expect(result.verifyToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(saved?.webhookUrl).toMatch(
      /^https:\/\/api\.suppline\.example\/v1\/public\/whatsapp\/.+\/webhook$/,
    );
    expect(saved?.webhookSecretHash).toBe(
      createHash('sha256').update(result.verifyToken).digest('hex'),
    );
    expect(saved?.encryptedCredentials).not.toContain('meta-access-token');
  });

  it('validates Meta challenge tokens and records successful verification', async () => {
    const token = 'one-time-verify-token';
    vi.mocked(repository.findWebhookCredential).mockResolvedValue({
      encryptedCredentials: 'unused',
      phoneNumberId: '123456789',
      webhookSecretHash: createHash('sha256').update(token).digest('hex'),
      workspaceId: 'workspace-1',
    });

    await expect(
      service.verifyWebhook(
        'connection-1',
        'subscribe',
        token,
        'challenge-123',
      ),
    ).resolves.toBe('challenge-123');
    expect(repository.markWebhookVerified).toHaveBeenCalledWith('connection-1');
  });

  it('rejects an invalid HMAC before parsing webhook data', async () => {
    vi.mocked(repository.findWebhookCredential).mockResolvedValue({
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ accessToken: 'token', appSecret: 'a'.repeat(32) }),
        { kind: 'whatsapp', workspaceId: 'workspace-1' },
      ),
      phoneNumberId: '123456789',
      webhookSecretHash: 'unused',
      workspaceId: 'workspace-1',
    });

    await expect(
      service.ingest(
        'connection-1',
        `sha256=${'0'.repeat(64)}`,
        Buffer.from('{}'),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.ingest).not.toHaveBeenCalled();
  });

  it('accepts signed messages and delivery status updates', async () => {
    const payload = webhookPayload();
    const rawBody = Buffer.from(JSON.stringify(payload));
    const appSecret = 'a'.repeat(32);
    vi.mocked(repository.findWebhookCredential).mockResolvedValue({
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ accessToken: 'token', appSecret }),
        { kind: 'whatsapp', workspaceId: 'workspace-1' },
      ),
      phoneNumberId: '123456789',
      webhookSecretHash: 'unused',
      workspaceId: 'workspace-1',
    });
    vi.mocked(repository.ingest).mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      ticketNumber: 1,
    });
    const signature = `sha256=${createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    await expect(
      service.ingest('connection-1', signature, rawBody, payload),
    ).resolves.toEqual({ accepted: true, ignored: false });
    expect(repository.ingest).toHaveBeenCalledWith(
      'connection-1',
      expect.objectContaining({
        body: 'Where is my order?',
        externalMessageId: 'wamid.inbound-1',
        phoneNumber: '919876543210',
      }),
    );
    expect(repository.markDeliveryStatus).toHaveBeenCalledWith(
      'connection-1',
      'wamid.sent-1',
      'delivered',
      expect.any(Date),
      null,
    );
  });

  it('sends only inside the 24-hour customer service window', async () => {
    vi.mocked(repository.findDeliveryContext).mockResolvedValue({
      channel: 'whatsapp',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ accessToken: 'token', appSecret: 'a'.repeat(32) }),
        { kind: 'whatsapp', workspaceId: 'workspace-1' },
      ),
      lastInboundAt: new Date(),
      phoneNumber: '919876543210',
      phoneNumberId: '123456789',
    });

    await expect(
      service.deliverReply('workspace-1', 'conversation-1', 'Order shipped.'),
    ).resolves.toBe('wamid.sent-1');
    expect(api.sendText).toHaveBeenCalledWith(
      'token',
      '123456789',
      '919876543210',
      'Order shipped.',
    );

    vi.mocked(repository.findDeliveryContext).mockResolvedValue({
      channel: 'whatsapp',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ accessToken: 'token', appSecret: 'a'.repeat(32) }),
        { kind: 'whatsapp', workspaceId: 'workspace-1' },
      ),
      lastInboundAt: new Date(Date.now() - 25 * 60 * 60_000),
      phoneNumber: '919876543210',
      phoneNumberId: '123456789',
    });
    await expect(
      service.deliverReply('workspace-1', 'conversation-1', 'Too late'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('parseWhatsAppWebhook', () => {
  it('ignores non-text data and payloads for another phone number', () => {
    expect(parseWhatsAppWebhook({}, '123456789')).toEqual({
      messages: [],
      statuses: [],
    });
    expect(parseWhatsAppWebhook(webhookPayload(), 'different')).toEqual({
      messages: [],
      statuses: [],
    });
  });
});

function webhookPayload() {
  return {
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              contacts: [
                { profile: { name: 'Amina K' }, wa_id: '919876543210' },
              ],
              messages: [
                {
                  from: '919876543210',
                  id: 'wamid.inbound-1',
                  text: { body: ' Where is my order? ' },
                  timestamp: '1783980000',
                  type: 'text',
                },
              ],
              metadata: { phone_number_id: '123456789' },
              statuses: [
                {
                  id: 'wamid.sent-1',
                  status: 'delivered',
                  timestamp: '1783980001',
                },
              ],
            },
          },
        ],
      },
    ],
    object: 'whatsapp_business_account',
  };
}
