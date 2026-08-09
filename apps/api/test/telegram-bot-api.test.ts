import { afterEach, describe, expect, it, vi } from 'vitest';

import { TelegramBotApiService } from '../src/support/telegram/telegram-bot-api.service';

describe('TelegramBotApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses getMe, secret webhook registration, and plain-text sendMessage', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const result = url.endsWith('/getMe')
        ? {
            first_name: 'Chanda Help',
            id: 123,
            is_bot: true,
            username: 'chanda_help_bot',
          }
        : url.endsWith('/sendMessage')
          ? { message_id: 44 }
          : true;
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, result }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = new TelegramBotApiService();

    await api.getMe('123:token');
    await api.setWebhook('123:token', {
      secretToken: 'secret_value',
      url: 'https://api.example.com/webhook',
    });
    await api.sendMessage('123:token', '9988', '<customer text>');

    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      body: JSON.stringify({
        allowed_updates: ['message'],
        drop_pending_updates: false,
        secret_token: 'secret_value',
        url: 'https://api.example.com/webhook',
      }),
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      body: JSON.stringify({ chat_id: '9988', text: '<customer text>' }),
    });
  });
});
