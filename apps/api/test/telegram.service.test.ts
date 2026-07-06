import { createHash } from 'node:crypto';

import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { ChannelCredentialCipher } from '../src/support/telegram/channel-credential-cipher';
import {
  parseTelegramUpdate,
  TelegramService,
} from '../src/support/telegram/telegram.service';
import type {
  TelegramBotApi,
  TelegramRepository,
} from '../src/support/telegram/telegram.types';

describe('TelegramService', () => {
  let api: TelegramBotApi;
  let repository: TelegramRepository;
  let findDeliveryContext: MockedFunction<
    TelegramRepository['findDeliveryContext']
  >;
  let findWebhookCredential: MockedFunction<
    TelegramRepository['findWebhookCredential']
  >;
  let saveConnection: MockedFunction<TelegramRepository['saveConnection']>;
  let sendMessage: MockedFunction<TelegramBotApi['sendMessage']>;
  let setWebhook: MockedFunction<TelegramBotApi['setWebhook']>;
  let service: TelegramService;

  beforeEach(() => {
    sendMessage = vi
      .fn<TelegramBotApi['sendMessage']>()
      .mockResolvedValue({ messageId: '42' });
    setWebhook = vi
      .fn<TelegramBotApi['setWebhook']>()
      .mockResolvedValue(undefined);
    api = {
      deleteWebhook: vi.fn().mockResolvedValue(undefined),
      getMe: vi.fn().mockResolvedValue({
        firstName: 'Suppline Help',
        id: '123456789',
        username: 'suppline_help_bot',
      }),
      sendMessage,
      setWebhook,
    };
    findDeliveryContext = vi.fn<TelegramRepository['findDeliveryContext']>();
    findWebhookCredential =
      vi.fn<TelegramRepository['findWebhookCredential']>();
    saveConnection = vi
      .fn<TelegramRepository['saveConnection']>()
      .mockImplementation((input) =>
        Promise.resolve({
          botFirstName: input.bot.firstName,
          botUsername: input.bot.username,
          id: input.connectionId,
          lastInboundAt: null,
          name: `${input.bot.firstName} (@${input.bot.username})`,
          status: 'active',
          webhookUrl: input.webhookUrl,
        }),
      );
    repository = {
      disconnect: vi.fn(),
      findConnection: vi.fn().mockResolvedValue(null),
      findDeliveryContext,
      findWebhookCredential,
      ingest: vi.fn(),
      saveConnection,
    };
    const config = new ConfigService({
      CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
        'base64',
      ),
      TELEGRAM_WEBHOOK_BASE_URL: 'https://api.suppline.example',
    });
    service = new TelegramService(
      repository,
      api,
      new ChannelCredentialCipher(config),
      config,
    );
  });

  it('verifies the bot and registers a secret webhook before persistence', async () => {
    const result = await service.connect(
      'workspace-1',
      '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi_12345',
    );

    expect(result.botUsername).toBe('suppline_help_bot');
    const webhookCall = setWebhook.mock.calls[0];
    const savedInput = saveConnection.mock.calls[0]?.[0];
    expect(webhookCall?.[0]).toBe(
      '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi_12345',
    );
    expect(webhookCall?.[1].secretToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(webhookCall?.[1].url).toMatch(
      /^https:\/\/api\.suppline\.example\/v1\/public\/telegram\/.+\/webhook$/,
    );
    expect(savedInput?.encryptedCredentials).not.toContain(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    );
    expect(savedInput?.webhookSecretHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a webhook whose secret does not match', async () => {
    findWebhookCredential.mockResolvedValue({
      encryptedCredentials: 'unused',
      webhookSecretHash: createHash('sha256')
        .update('correct-secret')
        .digest('hex'),
    });

    await expect(
      service.ingest('connection-1', 'wrong-secret', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delivers Telegram replies using decrypted write-only credentials', async () => {
    const cipher = new ChannelCredentialCipher(
      new ConfigService({
        CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          'base64',
        ),
      }),
    );
    findDeliveryContext.mockResolvedValue({
      channel: 'telegram',
      chatId: '998877',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ botToken: '123:secret-token' }),
      ),
    });

    await expect(
      service.deliverReply(
        'workspace-1',
        'conversation-1',
        'Your order shipped.',
      ),
    ).resolves.toBe('998877:42');
    expect(sendMessage).toHaveBeenCalledWith(
      '123:secret-token',
      '998877',
      'Your order shipped.',
    );
  });
});

describe('parseTelegramUpdate', () => {
  it('normalizes a private text message with a chat-scoped id', () => {
    expect(
      parseTelegramUpdate({
        message: {
          chat: { id: 998877, type: 'private' },
          date: 1_783_978_000,
          from: {
            first_name: '  Amina ',
            id: 445566,
            is_bot: false,
            last_name: 'K',
            username: 'amina_k',
          },
          message_id: 21,
          text: '  Where is my order?  ',
        },
        update_id: 1,
      }),
    ).toMatchObject({
      body: 'Where is my order?',
      chatId: '998877',
      displayName: 'Amina K',
      externalMessageId: '998877:21',
      telegramUserId: '445566',
      username: 'amina_k',
    });
  });

  it('ignores group, media-only, bot, and malformed updates', () => {
    expect(parseTelegramUpdate({ callback_query: {} })).toBeNull();
    expect(
      parseTelegramUpdate({
        message: {
          chat: { id: 1, type: 'group' },
          date: 1,
          from: { id: 2 },
          message_id: 3,
          text: 'hello',
        },
      }),
    ).toBeNull();
  });
});
