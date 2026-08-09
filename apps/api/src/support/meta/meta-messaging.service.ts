import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChannelCredentialCipher } from '../telegram/channel-credential-cipher';
import type {
  MetaChannelKind,
  MetaInboundMessage,
  MetaMessagingApi,
  MetaMessagingRepository,
} from './meta-messaging.types';

export const META_MESSAGING_API = Symbol('META_MESSAGING_API');
export const META_MESSAGING_REPOSITORY = Symbol('META_MESSAGING_REPOSITORY');

@Injectable()
export class MetaMessagingService {
  constructor(
    @Inject(META_MESSAGING_REPOSITORY)
    private readonly repository: MetaMessagingRepository,
    @Inject(META_MESSAGING_API) private readonly api: MetaMessagingApi,
    private readonly cipher: ChannelCredentialCipher,
    private readonly config: ConfigService,
  ) {}

  async getConnection(workspaceId: string, kind: MetaChannelKind) {
    return (
      (await this.repository.findConnection(workspaceId, kind)) ?? {
        assetId: null,
        assetName: null,
        id: null,
        kind,
        lastInboundAt: null,
        name: kind === 'facebook' ? 'Facebook Messenger' : 'Instagram',
        status: 'disconnected' as const,
        username: null,
        webhookUrl: null,
        webhookVerifiedAt: null,
      }
    );
  }

  async connect(
    workspaceId: string,
    kind: MetaChannelKind,
    input: { assetId: string; appSecret: string; pageAccessToken: string },
  ) {
    const pageAccessToken = input.pageAccessToken.trim();
    const appSecret = input.appSecret.trim();
    const assetId = input.assetId.trim();
    const asset = await this.api.getAsset(kind, pageAccessToken, assetId);
    const existing = await this.repository.findConnection(workspaceId, kind);
    const connectionId = existing?.id ?? randomUUID();
    const verifyToken = randomBytes(32).toString('base64url');
    const webhookUrl = `${this.webhookBaseUrl()}/v1/public/meta/${kind}/${connectionId}/webhook`;
    const saved = await this.repository.saveConnection({
      asset,
      connectionId,
      encryptedCredentials: this.cipher.encrypt(
        JSON.stringify({ appSecret, pageAccessToken }),
        { kind, workspaceId },
      ),
      kind,
      webhookSecretHash: hash(verifyToken),
      webhookUrl,
      workspaceId,
    });
    return { ...saved, verifyToken };
  }

  async disconnect(workspaceId: string, kind: MetaChannelKind) {
    if (!(await this.repository.disconnect(workspaceId, kind))) {
      throw new NotFoundException(`${label(kind)} connection not found.`);
    }
  }

  async verifyWebhook(
    connectionId: string,
    kind: MetaChannelKind,
    mode: string | undefined,
    suppliedToken: string | undefined,
    challenge: string | undefined,
  ) {
    if (mode !== 'subscribe' || !suppliedToken || !challenge) {
      throw new ForbiddenException('Meta webhook verification failed.');
    }
    const credential = await this.repository.findWebhookCredential(
      connectionId,
      kind,
    );
    if (
      !credential ||
      !safeEqual(hash(suppliedToken), credential.webhookSecretHash)
    ) {
      throw new ForbiddenException('Meta webhook verification failed.');
    }
    await this.repository.markWebhookVerified(connectionId, kind);
    return challenge;
  }

  async ingest(
    connectionId: string,
    kind: MetaChannelKind,
    signature: string | undefined,
    rawBody: Buffer | undefined,
    payload: unknown,
  ) {
    const credential = await this.repository.findWebhookCredential(
      connectionId,
      kind,
    );
    if (!credential) throw new NotFoundException('Meta webhook not found.');
    if (!signature || !rawBody) {
      throw new ForbiddenException('Meta webhook signature is missing.');
    }
    const { appSecret } = this.readCredentials(
      credential.encryptedCredentials,
      credential.workspaceId,
      kind,
    );
    const expected = `sha256=${createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;
    if (!safeEqual(signature, expected)) {
      throw new ForbiddenException('Meta webhook signature is invalid.');
    }
    const event = parseMetaMessagingWebhook(payload, kind, credential.assetId);
    for (const delivery of event.deliveries) {
      await this.repository.markDelivered(
        connectionId,
        delivery.externalMessageId,
        delivery.occurredAt,
      );
    }
    for (const message of event.messages) {
      const stored = await this.repository.ingest(connectionId, kind, message);
      if (!stored) throw new NotFoundException('Meta connection not found.');
    }
    return {
      accepted: true,
      ignored: event.deliveries.length === 0 && event.messages.length === 0,
    };
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
    if (context.channel === 'other') return undefined;
    if (!context.encryptedCredentials) {
      throw new ServiceUnavailableException(
        `${label(context.channel)} is disconnected. Ask an owner or admin to reconnect it before replying.`,
      );
    }
    if (Date.now() - context.lastInboundAt.getTime() >= 24 * 60 * 60_000) {
      throw new BadRequestException(
        `The ${label(context.channel)} 24-hour standard messaging window has closed. Ask the customer to send a new message before replying.`,
      );
    }
    const { pageAccessToken } = this.readCredentials(
      context.encryptedCredentials,
      workspaceId,
      context.channel,
    );
    const result = await this.api.sendText(
      context.channel,
      pageAccessToken,
      context.assetId,
      context.recipientId,
      body,
    );
    return result.messageId;
  }

  private readCredentials(
    encrypted: string,
    workspaceId: string,
    kind: MetaChannelKind,
  ) {
    try {
      const parsed = JSON.parse(
        this.cipher.decrypt(encrypted, { kind, workspaceId }),
      ) as { appSecret?: unknown; pageAccessToken?: unknown };
      if (
        typeof parsed.appSecret !== 'string' ||
        typeof parsed.pageAccessToken !== 'string'
      ) {
        throw new Error('missing credentials');
      }
      return {
        appSecret: parsed.appSecret,
        pageAccessToken: parsed.pageAccessToken,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Stored Meta messaging credentials cannot be read.',
      );
    }
  }

  private webhookBaseUrl() {
    const configured = this.config.get<string>(
      'META_MESSAGING_WEBHOOK_BASE_URL',
    );
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
        'Meta messaging setup needs a public HTTPS META_MESSAGING_WEBHOOK_BASE_URL. Use the deployed API URL or an HTTPS development tunnel.',
      );
    }
  }
}

export function parseMetaMessagingWebhook(
  payload: unknown,
  kind: MetaChannelKind,
  expectedAssetId: string,
): {
  deliveries: Array<{ externalMessageId: string; occurredAt: Date }>;
  messages: MetaInboundMessage[];
} {
  const result = {
    deliveries: [] as Array<{
      externalMessageId: string;
      occurredAt: Date;
    }>,
    messages: [] as MetaInboundMessage[],
  };
  const expectedObject = kind === 'facebook' ? 'page' : 'instagram';
  if (!isRecord(payload) || payload.object !== expectedObject) return result;
  for (const entry of array(payload.entry)) {
    if (!isRecord(entry) || entry.id !== expectedAssetId) continue;
    for (const messaging of array(entry.messaging)) {
      if (
        !isRecord(messaging) ||
        !isRecord(messaging.sender) ||
        typeof messaging.sender.id !== 'string' ||
        !isRecord(messaging.recipient) ||
        messaging.recipient.id !== expectedAssetId ||
        typeof messaging.timestamp !== 'number'
      ) {
        continue;
      }
      const occurredAt = new Date(messaging.timestamp);
      if (Number.isNaN(occurredAt.getTime())) continue;
      if (
        isRecord(messaging.message) &&
        messaging.message.is_echo !== true &&
        typeof messaging.message.mid === 'string' &&
        typeof messaging.message.text === 'string'
      ) {
        const body = messaging.message.text.trim();
        if (body && body.length <= 4096) {
          result.messages.push({
            body,
            displayName: `${label(kind)} customer ·${messaging.sender.id.slice(-4)}`,
            externalMessageId: messaging.message.mid,
            occurredAt,
            senderId: messaging.sender.id,
          });
        }
      }
      if (isRecord(messaging.delivery)) {
        for (const messageId of array(messaging.delivery.mids)) {
          if (typeof messageId === 'string') {
            result.deliveries.push({
              externalMessageId: messageId,
              occurredAt,
            });
          }
        }
      }
    }
  }
  return result;
}

export function requireMetaKind(value: string): MetaChannelKind {
  if (value !== 'facebook' && value !== 'instagram') {
    throw new BadRequestException('Unsupported Meta messaging channel.');
  }
  return value;
}

function label(kind: MetaChannelKind) {
  return kind === 'facebook' ? 'Facebook Messenger' : 'Instagram';
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
