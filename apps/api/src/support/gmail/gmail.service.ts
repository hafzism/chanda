import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChannelCredentialCipher } from '../telegram/channel-credential-cipher';
import type {
  GmailApi,
  GmailInboundMessage,
  GmailRawMessage,
  GmailRepository,
} from './gmail.types';

export const GMAIL_API = Symbol('GMAIL_API');
export const GMAIL_REPOSITORY = Symbol('GMAIL_REPOSITORY');

@Injectable()
export class GmailService {
  constructor(
    @Inject(GMAIL_REPOSITORY) private readonly repository: GmailRepository,
    @Inject(GMAIL_API) private readonly api: GmailApi,
    private readonly cipher: ChannelCredentialCipher,
    private readonly config: ConfigService,
  ) {}

  async getConnection(workspaceId: string) {
    const setup = this.configurationStatus();
    const connection = await this.repository.findConnection(workspaceId);
    return connection
      ? {
          ...connection,
          oauthConfigured: setup.configured,
          redirectUri: setup.redirectUri,
        }
      : {
          emailAddress: null,
          id: null,
          lastInboundAt: null,
          lastSyncAt: null,
          lastSyncError: null,
          name: 'Gmail',
          oauthConfigured: setup.configured,
          redirectUri: setup.redirectUri,
          status: 'disconnected' as const,
        };
  }

  async beginOAuth(workspaceId: string, userId: string) {
    const state = randomBytes(32).toString('base64url');
    const authorizationUrl = this.api.authorizationUrl(state);
    await this.repository.createOAuthState({
      expiresAt: new Date(Date.now() + 10 * 60_000),
      requestedByUserId: userId,
      stateHash: hash(state),
      workspaceId,
    });
    return { authorizationUrl };
  }

  async completeOAuth(code: string | undefined, state: string | undefined) {
    if (
      !code ||
      code.length > 2_048 ||
      !state ||
      !/^[A-Za-z0-9_-]{43}$/.test(state)
    ) {
      throw new BadRequestException('Google OAuth response is incomplete.');
    }
    const pending = await this.repository.consumeOAuthState(hash(state));
    if (!pending) {
      throw new BadRequestException(
        'This Gmail connection link expired or was already used.',
      );
    }
    const tokens = await this.api.exchangeCode(code);
    const profile = await this.api.getProfile(tokens.accessToken);
    const existing = await this.repository.findConnection(pending.workspaceId);
    await this.repository.saveConnection({
      connectionId: existing?.id ?? randomUUID(),
      emailAddress: profile.emailAddress.toLowerCase(),
      encryptedCredentials: this.cipher.encrypt(
        JSON.stringify({ refreshToken: tokens.refreshToken }),
      ),
      historyId: profile.historyId,
      workspaceId: pending.workspaceId,
    });
    return pending.workspaceId;
  }

  async sync(workspaceId: string) {
    const credential = await this.repository.findCredential(workspaceId);
    if (!credential) throw new NotFoundException('Gmail is not connected.');
    try {
      const accessToken = await this.api.refreshAccessToken(
        this.readRefreshToken(credential.encryptedCredentials),
      );
      const emailAddress = readSetting(credential.settings, 'emailAddress');
      const previousHistoryId = readSetting(credential.settings, 'historyId');
      const hasSynced = Boolean(readSetting(credential.settings, 'lastSyncAt'));
      let ids: string[];
      let historyId: string;

      if (hasSynced && previousHistoryId) {
        const history = await this.api.listHistory(
          accessToken,
          previousHistoryId,
        );
        if (history === 'expired') {
          ids = await this.api.listInitialMessageIds(accessToken);
          historyId = (await this.api.getProfile(accessToken)).historyId;
        } else {
          ids = history.messageIds;
          historyId = history.historyId;
        }
      } else {
        ids = await this.api.listInitialMessageIds(accessToken);
        historyId = (await this.api.getProfile(accessToken)).historyId;
      }

      const messages: GmailInboundMessage[] = [];
      for (const id of ids) {
        const parsed = parseGmailMessage(
          await this.api.getMessage(accessToken, id),
          emailAddress,
        );
        if (parsed) messages.push(parsed);
      }
      messages.sort(
        (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
      );
      for (const parsed of messages) {
        await this.repository.ingest(credential.connectionId, parsed);
      }
      const syncedAt = new Date();
      await this.repository.saveSyncSuccess(workspaceId, historyId, syncedAt);
      return { imported: messages.length, syncedAt };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Mailbox synchronization failed.';
      await this.repository.markSyncFailure(workspaceId, message);
      throw error;
    }
  }

  async disconnect(workspaceId: string) {
    const credential = await this.repository.findCredential(workspaceId);
    if (!credential) throw new NotFoundException('Gmail is not connected.');
    await this.api.revoke(
      this.readRefreshToken(credential.encryptedCredentials),
    );
    if (!(await this.repository.disconnect(workspaceId))) {
      throw new NotFoundException('Gmail is not connected.');
    }
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
    if (context.channel !== 'gmail') return undefined;
    const accessToken = await this.api.refreshAccessToken(
      this.readRefreshToken(context.encryptedCredentials),
    );
    const result = await this.api.sendMessage(accessToken, {
      raw: createReplyMime({
        body,
        inReplyTo: context.messageIdHeader,
        subject: context.subject,
        to: context.to,
      }),
      threadId: context.threadId,
    });
    return result.id;
  }

  callbackUrl(input: { error?: string; message?: string; success: boolean }) {
    const origin =
      this.config.get<string>('WEB_APP_ORIGIN') ?? 'http://localhost:3000';
    const parameters = new URLSearchParams({
      gmail: input.success ? 'connected' : 'error',
      section: 'Channels',
      ...(input.message ? { message: input.message.slice(0, 180) } : {}),
    });
    return `${origin.replace(/\/$/, '')}/app?${parameters}`;
  }

  configurationStatus() {
    const redirectUri =
      this.config.get<string>('GMAIL_OAUTH_REDIRECT_URI') ??
      'http://localhost:4000/v1/public/gmail/oauth/callback';
    return {
      configured: Boolean(
        this.config.get<string>('GOOGLE_GMAIL_CLIENT_ID') &&
        this.config.get<string>('GOOGLE_GMAIL_CLIENT_SECRET') &&
        this.config.get<string>('GMAIL_OAUTH_REDIRECT_URI'),
      ),
      redirectUri,
    };
  }

  private readRefreshToken(encrypted: string) {
    try {
      const parsed = JSON.parse(this.cipher.decrypt(encrypted)) as {
        refreshToken?: unknown;
      };
      if (typeof parsed.refreshToken !== 'string') throw new Error('missing');
      return parsed.refreshToken;
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Stored Gmail credentials cannot be read.',
      );
    }
  }
}

export function parseGmailMessage(
  message: GmailRawMessage,
  mailboxEmail: string,
): GmailInboundMessage | null {
  const headers = new Map(
    (message.payload.headers ?? []).map(({ name, value }) => [
      name.toLowerCase(),
      value,
    ]),
  );
  const sender = parseAddress(headers.get('from'));
  if (!sender || sender.email.toLowerCase() === mailboxEmail.toLowerCase()) {
    return null;
  }
  const body = extractBody(message.payload).trim();
  if (!body) return null;
  const internalDate = Number(message.internalDate);
  if (!Number.isFinite(internalDate)) return null;
  return {
    body: body.slice(0, 50_000),
    externalMessageId: message.id,
    fromEmail: sender.email.toLowerCase(),
    fromName: sender.name,
    gmailMessageIdHeader: headers.get('message-id') ?? null,
    occurredAt: new Date(internalDate),
    subject: sanitizeHeader(headers.get('subject') ?? 'Support request'),
    threadId: message.threadId,
  };
}

export function createReplyMime(input: {
  body: string;
  inReplyTo: string | null;
  subject: string;
  to: string;
}) {
  const subject = sanitizeHeader(input.subject);
  const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  const headers = [
    `To: ${sanitizeHeader(input.to)}`,
    `Subject: ${replySubject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    'MIME-Version: 1.0',
    ...(input.inReplyTo
      ? [
          `In-Reply-To: ${sanitizeHeader(input.inReplyTo)}`,
          `References: ${sanitizeHeader(input.inReplyTo)}`,
        ]
      : []),
  ];
  return Buffer.from(
    `${headers.join('\r\n')}\r\n\r\n${input.body}`,
    'utf8',
  ).toString('base64url');
}

function extractBody(payload: GmailRawMessage['payload']): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decode(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractBody(part);
    if (text) return text;
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decode(payload.body.data)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }
  return payload.body?.data ? decode(payload.body.data) : '';
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function parseAddress(value: string | undefined) {
  if (!value) return null;
  const match = value.match(
    /^(?:"?([^"<]*)"?\s*)?<([^<>\s]+@[^<>\s]+)>$|^([^<>\s]+@[^<>\s]+)$/,
  );
  const email = match?.[2] ?? match?.[3];
  if (!email) return null;
  const name = match?.[1]?.trim() || null;
  return { email, name };
}

function sanitizeHeader(value: string) {
  return value
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 998);
}

function readSetting(settings: Record<string, unknown>, key: string) {
  return typeof settings[key] === 'string' ? settings[key] : '';
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
