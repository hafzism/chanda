import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { TelegramBotApi, TelegramBotIdentity } from './telegram.types';

interface TelegramResponse<T> {
  description?: string;
  ok: boolean;
  result?: T;
}

@Injectable()
export class TelegramBotApiService implements TelegramBotApi {
  async getMe(token: string): Promise<TelegramBotIdentity> {
    const result = await this.request<{
      first_name: string;
      id: number;
      is_bot: boolean;
      username?: string;
    }>(token, 'getMe');
    if (!result.is_bot || !result.username) {
      throw new UnauthorizedException(
        'Telegram did not return a usable bot username for this token.',
      );
    }
    return {
      firstName: result.first_name,
      id: String(result.id),
      username: result.username,
    };
  }

  async setWebhook(
    token: string,
    input: { secretToken: string; url: string },
  ): Promise<void> {
    await this.request(token, 'setWebhook', {
      allowed_updates: ['message'],
      drop_pending_updates: false,
      secret_token: input.secretToken,
      url: input.url,
    });
  }

  async deleteWebhook(token: string): Promise<void> {
    await this.request(token, 'deleteWebhook', {
      drop_pending_updates: false,
    });
  }

  async sendMessage(
    token: string,
    chatId: string,
    body: string,
  ): Promise<{ messageId: string }> {
    const result = await this.request<{ message_id: number }>(
      token,
      'sendMessage',
      { chat_id: chatId, text: body },
    );
    return { messageId: String(result.message_id) };
  }

  private async request<T = true>(
    token: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        ...(body
          ? {
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            }
          : {}),
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException(
        'Telegram could not be reached. Check the connection and try again.',
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as TelegramResponse<T> | null;
    if (!response.ok || !payload?.ok || payload.result === undefined) {
      const message =
        response.status === 401
          ? 'Telegram rejected this bot token. Create or regenerate it in BotFather.'
          : (payload?.description ?? 'Telegram rejected the request.');
      if (response.status === 401) throw new UnauthorizedException(message);
      throw new BadGatewayException(message);
    }
    return payload.result;
  }
}
