import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { GmailApi, GmailRawMessage, GmailTokenSet } from './gmail.types';

@Injectable()
export class GmailApiService implements GmailApi {
  constructor(private readonly config: ConfigService) {}

  authorizationUrl(state: string): string {
    const configuration = this.configuration();
    const parameters = new URLSearchParams({
      access_type: 'offline',
      client_id: configuration.clientId,
      include_granted_scopes: 'true',
      prompt: 'consent select_account',
      redirect_uri: configuration.redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
      ].join(' '),
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${parameters}`;
  }

  async exchangeCode(code: string): Promise<GmailTokenSet> {
    const configuration = this.configuration();
    const payload = await this.tokenRequest({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: configuration.redirectUri,
    });
    if (typeof payload.refresh_token !== 'string' || !payload.refresh_token) {
      throw new UnauthorizedException(
        'Google did not return offline mailbox access. Revoke Suppline in your Google Account and connect again.',
      );
    }
    return {
      accessToken: requireString(payload.access_token, 'access token'),
      refreshToken: payload.refresh_token,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const configuration = this.configuration();
    const payload = await this.tokenRequest({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return requireString(payload.access_token, 'access token');
  }

  async getProfile(accessToken: string) {
    return this.request<{ emailAddress: string; historyId: string }>(
      accessToken,
      '/profile',
    );
  }

  async listInitialMessageIds(accessToken: string): Promise<string[]> {
    const parameters = new URLSearchParams({
      maxResults: '50',
      q: 'in:inbox -from:me newer_than:30d',
    });
    const result = await this.request<{ messages?: Array<{ id: string }> }>(
      accessToken,
      `/messages?${parameters}`,
    );
    return result.messages?.map(({ id }) => id) ?? [];
  }

  async listHistory(accessToken: string, historyId: string) {
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let newestHistoryId = historyId;
    do {
      const parameters = new URLSearchParams({
        historyTypes: 'messageAdded',
        labelId: 'INBOX',
        maxResults: '100',
        startHistoryId: historyId,
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await this.request<{
        history?: Array<{
          messagesAdded?: Array<{ message: { id: string } }>;
        }>;
        historyId: string;
        nextPageToken?: string;
      }>(accessToken, `/history?${parameters}`, undefined, true);
      if (response === 'history_expired') return 'expired' as const;
      newestHistoryId = response.historyId;
      for (const record of response.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          messageIds.add(added.message.id);
        }
      }
      pageToken = response.nextPageToken;
    } while (pageToken);
    return { historyId: newestHistoryId, messageIds: [...messageIds] };
  }

  getMessage(accessToken: string, messageId: string) {
    return this.request<GmailRawMessage>(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}?format=full`,
    );
  }

  sendMessage(accessToken: string, input: { raw: string; threadId: string }) {
    return this.request<{ id: string; threadId: string }>(
      accessToken,
      '/messages/send',
      input,
    );
  }

  async revoke(refreshToken: string): Promise<void> {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?${new URLSearchParams({ token: refreshToken })}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      // Local credential deletion still disconnects Suppline. The UI explains
      // how to revoke access in the Google Account security page if needed.
    }
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

  private configuration() {
    const clientId = this.config.get<string>('GOOGLE_GMAIL_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_GMAIL_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GMAIL_OAUTH_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        'Gmail OAuth is not configured. Add the Google OAuth client ID, client secret, and exact redirect URI shown in Channels.',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private async tokenRequest(input: Record<string, string>) {
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        body: new URLSearchParams(input),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException('Google OAuth could not be reached.');
    }
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !payload) {
      throw new UnauthorizedException(
        typeof payload?.error_description === 'string'
          ? payload.error_description
          : 'Google rejected the OAuth token exchange.',
      );
    }
    return payload;
  }

  private request<T>(
    accessToken: string,
    path: string,
    body: Record<string, unknown> | undefined,
    allowExpiredHistory: true,
  ): Promise<T | 'history_expired'>;
  private request<T>(
    accessToken: string,
    path: string,
    body?: Record<string, unknown>,
    allowExpiredHistory?: false,
  ): Promise<T>;
  private async request<T>(
    accessToken: string,
    path: string,
    body?: Record<string, unknown>,
    allowExpiredHistory = false,
  ): Promise<T | 'history_expired'> {
    let response: Response;
    try {
      response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me${path}`,
        {
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
        },
      );
    } catch {
      throw new BadGatewayException('Gmail could not be reached.');
    }
    if (allowExpiredHistory && response.status === 404) {
      return 'history_expired';
    }
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok || !payload) {
      throw new BadGatewayException('Gmail rejected the mailbox request.');
    }
    return payload;
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) {
    throw new UnauthorizedException(`Google did not return a usable ${name}.`);
  }
  return value;
}
