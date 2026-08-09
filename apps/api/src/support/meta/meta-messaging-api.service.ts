import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MetaChannelKind, MetaMessagingApi } from './meta-messaging.types';

@Injectable()
export class MetaMessagingApiService implements MetaMessagingApi {
  constructor(private readonly config: ConfigService) {}

  async getAsset(
    kind: MetaChannelKind,
    pageAccessToken: string,
    assetId: string,
  ) {
    const fields = kind === 'instagram' ? 'id,name,username' : 'id,name';
    const result = await this.request<{
      id: string;
      name?: string;
      username?: string;
    }>(pageAccessToken, `/${assetId}?fields=${fields}`);
    if (result.id !== assetId) {
      throw new UnauthorizedException('Meta returned a different account ID.');
    }
    const name = result.name?.trim() || result.username?.trim();
    if (!name) throw new BadGatewayException('Meta returned no account name.');
    return {
      id: result.id,
      name,
      username: result.username?.trim() || null,
    };
  }

  async sendText(
    _kind: MetaChannelKind,
    pageAccessToken: string,
    assetId: string,
    recipientId: string,
    body: string,
  ) {
    const result = await this.request<{
      message_id?: string;
    }>(pageAccessToken, `/${assetId}/messages`, {
      message: { text: body },
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
    });
    if (!result.message_id) {
      throw new BadGatewayException(
        'Meta accepted no message identifier for this reply.',
      );
    }
    return { messageId: result.message_id };
  }

  private async request<T>(
    token: string,
    path: string,
    body?: Record<string, unknown>,
  ) {
    const version =
      this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v24.0';
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${version}${path}`, {
        ...(body
          ? {
              body: JSON.stringify(body),
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              method: 'POST',
            }
          : {
              headers: { Authorization: `Bearer ${token}` },
              method: 'GET',
            }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Meta Graph API could not be reached.');
    }
    const payload = (await response.json().catch(() => null)) as
      (T & { error?: { message?: string } }) | null;
    if (!response.ok || !payload) {
      throw new UnauthorizedException(
        payload?.error?.message ?? 'Meta rejected this account or token.',
      );
    }
    return payload;
  }
}
