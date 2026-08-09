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
  WhatsAppApi,
  WhatsAppInboundMessage,
  WhatsAppRepository,
} from './whatsapp.types';

export const WHATSAPP_API = Symbol('WHATSAPP_API');
export const WHATSAPP_REPOSITORY = Symbol('WHATSAPP_REPOSITORY');

@Injectable()
export class WhatsAppService {
  constructor(
    @Inject(WHATSAPP_REPOSITORY)
    private readonly repository: WhatsAppRepository,
    @Inject(WHATSAPP_API) private readonly api: WhatsAppApi,
    private readonly cipher: ChannelCredentialCipher,
    private readonly config: ConfigService,
  ) {}

  async getConnection(workspaceId: string) {
    return (
      (await this.repository.findConnection(workspaceId)) ?? {
        displayPhoneNumber: null,
        id: null,
        lastInboundAt: null,
        name: 'WhatsApp',
        phoneNumberId: null,
        status: 'disconnected' as const,
        verifiedName: null,
        webhookUrl: null,
        webhookVerifiedAt: null,
      }
    );
  }

  async connect(
    workspaceId: string,
    input: { accessToken: string; appSecret: string; phoneNumberId: string },
  ) {
    const accessToken = input.accessToken.trim();
    const appSecret = input.appSecret.trim();
    const phoneNumberId = input.phoneNumberId.trim();
    const phone = await this.api.getPhone(accessToken, phoneNumberId);
    if (phone.id !== phoneNumberId) {
      throw new BadRequestException(
        'Meta returned a different WhatsApp phone number ID.',
      );
    }
    const existing = await this.repository.findConnection(workspaceId);
    const connectionId = existing?.id ?? randomUUID();
    const verifyToken = randomBytes(32).toString('base64url');
    const webhookUrl = `${this.webhookBaseUrl()}/v1/public/whatsapp/${connectionId}/webhook`;
    const saved = await this.repository.saveConnection({
      connectionId,
      encryptedCredentials: this.cipher.encrypt(
        JSON.stringify({ accessToken, appSecret }),
        { kind: 'whatsapp', workspaceId },
      ),
      phone,
      webhookSecretHash: hash(verifyToken),
      webhookUrl,
      workspaceId,
    });
    return { ...saved, verifyToken };
  }

  async disconnect(workspaceId: string) {
    if (!(await this.repository.disconnect(workspaceId))) {
      throw new NotFoundException('WhatsApp connection not found.');
    }
  }

  async verifyWebhook(
    connectionId: string,
    mode: string | undefined,
    suppliedToken: string | undefined,
    challenge: string | undefined,
  ) {
    if (mode !== 'subscribe' || !suppliedToken || !challenge) {
      throw new ForbiddenException('WhatsApp webhook verification failed.');
    }
    const credential =
      await this.repository.findWebhookCredential(connectionId);
    if (
      !credential ||
      !safeEqual(hash(suppliedToken), credential.webhookSecretHash)
    ) {
      throw new ForbiddenException('WhatsApp webhook verification failed.');
    }
    await this.repository.markWebhookVerified(connectionId);
    return challenge;
  }

  async ingest(
    connectionId: string,
    signature: string | undefined,
    rawBody: Buffer | undefined,
    payload: unknown,
  ) {
    const credential =
      await this.repository.findWebhookCredential(connectionId);
    if (!credential) throw new NotFoundException('WhatsApp webhook not found.');
    if (!signature || !rawBody) {
      throw new ForbiddenException('WhatsApp webhook signature is missing.');
    }
    const { appSecret } = this.readCredentials(
      credential.encryptedCredentials,
      credential.workspaceId,
    );
    const expected = `sha256=${createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;
    if (!safeEqual(signature, expected)) {
      throw new ForbiddenException('WhatsApp webhook signature is invalid.');
    }
    const event = parseWhatsAppWebhook(payload, credential.phoneNumberId);
    for (const status of event.statuses) {
      await this.repository.markDeliveryStatus(
        connectionId,
        status.externalMessageId,
        status.status,
        status.occurredAt,
        status.error,
      );
    }
    for (const message of event.messages) {
      const result = await this.repository.ingest(connectionId, message);
      if (!result)
        throw new NotFoundException('WhatsApp connection not found.');
    }
    return {
      accepted: true,
      ignored: event.messages.length === 0 && event.statuses.length === 0,
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
    if (context.channel !== 'whatsapp') return undefined;
    if (!context.encryptedCredentials) {
      throw new ServiceUnavailableException(
        'WhatsApp is disconnected. Ask an owner or admin to reconnect it before replying.',
      );
    }
    if (Date.now() - context.lastInboundAt.getTime() >= 24 * 60 * 60_000) {
      throw new BadRequestException(
        'The WhatsApp 24-hour customer service window has closed. An approved Meta template is required before free-form replies can resume.',
      );
    }
    const { accessToken } = this.readCredentials(
      context.encryptedCredentials,
      workspaceId,
    );
    const result = await this.api.sendText(
      accessToken,
      context.phoneNumberId,
      context.phoneNumber,
      body,
    );
    return result.messageId;
  }

  private readCredentials(encrypted: string, workspaceId: string) {
    try {
      const parsed = JSON.parse(
        this.cipher.decrypt(encrypted, { kind: 'whatsapp', workspaceId }),
      ) as { accessToken?: unknown; appSecret?: unknown };
      if (
        typeof parsed.accessToken !== 'string' ||
        typeof parsed.appSecret !== 'string'
      ) {
        throw new Error('missing credentials');
      }
      return { accessToken: parsed.accessToken, appSecret: parsed.appSecret };
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Stored WhatsApp credentials cannot be read.',
      );
    }
  }

  private webhookBaseUrl() {
    const configured = this.config.get<string>('WHATSAPP_WEBHOOK_BASE_URL');
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
        'WhatsApp setup needs a public HTTPS WHATSAPP_WEBHOOK_BASE_URL. Use the deployed API URL or an HTTPS development tunnel.',
      );
    }
  }
}

export function parseWhatsAppWebhook(
  payload: unknown,
  expectedPhoneNumberId: string,
): {
  messages: WhatsAppInboundMessage[];
  statuses: Array<{
    error: string | null;
    externalMessageId: string;
    occurredAt: Date;
    status: string;
  }>;
} {
  const result: ReturnType<typeof emptyEvent> = emptyEvent();
  if (!isRecord(payload) || payload.object !== 'whatsapp_business_account') {
    return result;
  }
  for (const entry of array(payload.entry)) {
    if (!isRecord(entry)) continue;
    for (const change of array(entry.changes)) {
      if (
        !isRecord(change) ||
        change.field !== 'messages' ||
        !isRecord(change.value)
      ) {
        continue;
      }
      const value = change.value;
      if (
        !isRecord(value.metadata) ||
        value.metadata.phone_number_id !== expectedPhoneNumberId
      ) {
        continue;
      }
      const contactNames = new Map<string, string>();
      for (const contact of array(value.contacts)) {
        if (
          isRecord(contact) &&
          typeof contact.wa_id === 'string' &&
          isRecord(contact.profile) &&
          typeof contact.profile.name === 'string'
        ) {
          contactNames.set(contact.wa_id, contact.profile.name.trim());
        }
      }
      for (const raw of array(value.messages)) {
        if (
          !isRecord(raw) ||
          raw.type !== 'text' ||
          typeof raw.id !== 'string' ||
          typeof raw.from !== 'string' ||
          typeof raw.timestamp !== 'string' ||
          !isRecord(raw.text) ||
          typeof raw.text.body !== 'string'
        ) {
          continue;
        }
        const body = raw.text.body.trim();
        const occurredAt = parseTimestamp(raw.timestamp);
        if (!body || body.length > 4096 || !occurredAt) continue;
        result.messages.push({
          body,
          displayName:
            contactNames.get(raw.from) || `WhatsApp user +${raw.from}`,
          externalMessageId: raw.id,
          occurredAt,
          phoneNumber: raw.from,
        });
      }
      for (const raw of array(value.statuses)) {
        if (
          !isRecord(raw) ||
          typeof raw.id !== 'string' ||
          typeof raw.status !== 'string' ||
          typeof raw.timestamp !== 'string'
        ) {
          continue;
        }
        const occurredAt = parseTimestamp(raw.timestamp);
        if (!occurredAt) continue;
        const firstError = array(raw.errors).find(isRecord);
        result.statuses.push({
          error:
            typeof firstError?.title === 'string'
              ? firstError.title.slice(0, 500)
              : null,
          externalMessageId: raw.id,
          occurredAt,
          status: raw.status.slice(0, 40),
        });
      }
    }
  }
  return result;
}

function emptyEvent() {
  return {
    messages: [] as WhatsAppInboundMessage[],
    statuses: [] as Array<{
      error: string | null;
      externalMessageId: string;
      occurredAt: Date;
      status: string;
    }>,
  };
}

function parseTimestamp(value: string) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000)
    : null;
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
