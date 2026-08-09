import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChannelCredentialCipher } from './channel-credential-cipher';
import type {
  TelegramBotApi,
  TelegramInboundMessage,
  TelegramRepository,
} from './telegram.types';

export const TELEGRAM_BOT_API = Symbol('TELEGRAM_BOT_API');
export const TELEGRAM_REPOSITORY = Symbol('TELEGRAM_REPOSITORY');

@Injectable()
export class TelegramService {
  constructor(
    @Inject(TELEGRAM_REPOSITORY)
    private readonly repository: TelegramRepository,
    @Inject(TELEGRAM_BOT_API) private readonly api: TelegramBotApi,
    private readonly cipher: ChannelCredentialCipher,
    private readonly config: ConfigService,
  ) {}

  async getConnection(workspaceId: string) {
    return (
      (await this.repository.findConnection(workspaceId)) ?? {
        botFirstName: null,
        botUsername: null,
        id: null,
        lastInboundAt: null,
        name: 'Telegram',
        status: 'disconnected' as const,
        webhookUrl: null,
      }
    );
  }

  async connect(workspaceId: string, botToken: string) {
    const token = botToken.trim();
    const webhookBaseUrl = this.webhookBaseUrl();
    const bot = await this.api.getMe(token);
    const existing = await this.repository.findConnection(workspaceId);
    const connectionId = existing?.id ?? randomUUID();
    const oldCredential = existing
      ? await this.repository.findWebhookCredential(existing.id)
      : null;
    const oldToken = oldCredential
      ? this.readToken(oldCredential.encryptedCredentials, workspaceId)
      : null;
    const secretToken = randomBytes(32).toString('base64url');
    const webhookUrl = `${webhookBaseUrl}/v1/public/telegram/${connectionId}/webhook`;
    const encryptedCredentials = this.cipher.encrypt(
      JSON.stringify({ botToken: token }),
      { kind: 'telegram', workspaceId },
    );

    await this.api.setWebhook(token, { secretToken, url: webhookUrl });
    try {
      const saved = await this.repository.saveConnection({
        bot,
        connectionId,
        encryptedCredentials,
        webhookSecretHash: hashSecret(secretToken),
        webhookUrl,
        workspaceId,
      });
      if (oldToken && oldToken !== token) {
        await Promise.allSettled([this.api.deleteWebhook(oldToken)]);
      }
      return saved;
    } catch (error: unknown) {
      await Promise.allSettled([this.api.deleteWebhook(token)]);
      throw error;
    }
  }

  async disconnect(workspaceId: string) {
    const connection = await this.repository.findConnection(workspaceId);
    if (!connection || connection.status === 'disconnected') {
      throw new NotFoundException('Telegram connection not found.');
    }
    const credential = await this.repository.findWebhookCredential(
      connection.id,
    );
    if (!credential)
      throw new ServiceUnavailableException(
        'Telegram credentials are unavailable. Reconnect the bot first.',
      );
    await this.api.deleteWebhook(
      this.readToken(credential.encryptedCredentials, workspaceId),
    );
    if (!(await this.repository.disconnect(workspaceId))) {
      throw new NotFoundException('Telegram connection not found.');
    }
  }

  async ingest(
    connectionId: string,
    suppliedSecret: string | undefined,
    payload: unknown,
  ) {
    const credential =
      await this.repository.findWebhookCredential(connectionId);
    if (!credential || !suppliedSecret) {
      throw new NotFoundException('Telegram webhook not found.');
    }
    const actual = Buffer.from(hashSecret(suppliedSecret), 'hex');
    const expected = Buffer.from(credential.webhookSecretHash, 'hex');
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new ForbiddenException('Telegram webhook secret is invalid.');
    }
    const message = parseTelegramUpdate(payload);
    if (!message) return { accepted: true, ignored: true };
    const result = await this.repository.ingest(connectionId, message);
    if (!result) throw new NotFoundException('Telegram connection not found.');
    return { accepted: true, ignored: false };
  }

  async deliverReply(
    workspaceId: string,
    conversationId: string,
    body: string,
    draftId?: string,
  ): Promise<string | undefined> {
    const context = await this.repository.findDeliveryContext(
      workspaceId,
      conversationId,
      draftId,
    );
    if (!context) throw new NotFoundException('Conversation not found.');
    if (context.channel !== 'telegram') return undefined;
    if (!context.encryptedCredentials) {
      throw new ServiceUnavailableException(
        'Telegram is disconnected. Ask a workspace owner or admin to reconnect the bot before replying.',
      );
    }
    const result = await this.api.sendMessage(
      this.readToken(context.encryptedCredentials, workspaceId),
      context.chatId,
      body,
    );
    return `${context.chatId}:${result.messageId}`;
  }

  private readToken(encryptedCredentials: string, workspaceId: string): string {
    try {
      const parsed = JSON.parse(
        this.cipher.decrypt(encryptedCredentials, {
          kind: 'telegram',
          workspaceId,
        }),
      ) as { botToken?: unknown };
      if (typeof parsed.botToken !== 'string') throw new Error('missing token');
      return parsed.botToken;
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Stored Telegram credentials cannot be read.',
      );
    }
  }

  private webhookBaseUrl(): string {
    const configured = this.config.get<string>('TELEGRAM_WEBHOOK_BASE_URL');
    try {
      const url = new URL(configured ?? '');
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error('invalid URL');
      }
      return url.href.replace(/\/$/, '');
    } catch {
      throw new ServiceUnavailableException(
        'Telegram setup needs a public HTTPS TELEGRAM_WEBHOOK_BASE_URL. Use your deployed API URL or an HTTPS development tunnel.',
      );
    }
  }
}

function hashSecret(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseTelegramUpdate(
  payload: unknown,
): TelegramInboundMessage | null {
  if (!isRecord(payload) || !isRecord(payload.message)) return null;
  const message = payload.message;
  if (
    typeof message.message_id !== 'number' ||
    typeof message.date !== 'number' ||
    typeof message.text !== 'string' ||
    !isRecord(message.chat) ||
    message.chat.type !== 'private' ||
    typeof message.chat.id !== 'number' ||
    !isRecord(message.from) ||
    typeof message.from.id !== 'number' ||
    message.from.is_bot === true
  ) {
    return null;
  }
  const body = message.text.trim();
  if (!body || body.length > 4096) return null;
  const firstName =
    typeof message.from.first_name === 'string'
      ? message.from.first_name.trim()
      : '';
  const lastName =
    typeof message.from.last_name === 'string'
      ? message.from.last_name.trim()
      : '';
  const username =
    typeof message.from.username === 'string'
      ? message.from.username.trim()
      : null;
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    (username ? `@${username}` : `Telegram user ${message.from.id}`);
  return {
    body,
    chatId: String(message.chat.id),
    displayName,
    externalMessageId: `${message.chat.id}:${message.message_id}`,
    occurredAt: new Date(message.date * 1000),
    telegramUserId: String(message.from.id),
    username,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
