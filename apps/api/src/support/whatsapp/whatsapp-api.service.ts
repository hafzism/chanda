import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { WhatsAppApi, WhatsAppPhoneIdentity } from './whatsapp.types';

@Injectable()
export class WhatsAppCloudApiService implements WhatsAppApi {
  constructor(private readonly config: ConfigService) {}

  async getPhone(accessToken: string, phoneNumberId: string) {
    const result = await this.request<{
      display_phone_number: string;
      id: string;
      verified_name: string;
    }>(
      accessToken,
      `/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
    );
    return {
      displayPhoneNumber: requireString(
        result.display_phone_number,
        'display phone number',
      ),
      id: requireString(result.id, 'phone number ID'),
      verifiedName: requireString(result.verified_name, 'verified name'),
    } satisfies WhatsAppPhoneIdentity;
  }

  async sendText(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    body: string,
  ) {
    const result = await this.request<{
      messages?: Array<{ id: string }>;
    }>(accessToken, `/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      text: { body, preview_url: false },
      to,
      type: 'text',
    });
    const messageId = result.messages?.[0]?.id;
    if (!messageId) {
      throw new BadGatewayException(
        'WhatsApp accepted no message identifier for this reply.',
      );
    }
    return { messageId };
  }

  private async request<T>(
    accessToken: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const version =
      this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v24.0';
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${version}${path}`, {
        ...(body
          ? {
              body: JSON.stringify(body),
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              method: 'POST',
            }
          : {
              headers: { Authorization: `Bearer ${accessToken}` },
              method: 'GET',
            }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Meta Graph API could not be reached.');
    }
    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: { message?: string } })
      | null;
    if (!response.ok || !payload) {
      throw new UnauthorizedException(
        payload?.error?.message ??
          'Meta rejected the WhatsApp credentials or request.',
      );
    }
    return payload;
  }
}

function requireString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value) {
    throw new BadGatewayException(`Meta did not return a usable ${name}.`);
  }
  return value;
}
