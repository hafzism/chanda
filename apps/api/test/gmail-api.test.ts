import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GmailApiService } from '../src/support/gmail/gmail-api.service';

describe('GmailApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  const createApi = () =>
    new GmailApiService(
      new ConfigService({
        GMAIL_OAUTH_REDIRECT_URI:
          'https://api.suppline.example/v1/public/gmail/oauth/callback',
        GOOGLE_GMAIL_CLIENT_ID: 'client-id',
        GOOGLE_GMAIL_CLIENT_SECRET: 'client-secret',
      }),
    );

  it('requests offline least-privilege Gmail access with the supplied state', () => {
    const url = new URL(createApi().authorizationUrl('one-time-state'));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe('one-time-state');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ]);
  });

  it('exchanges an authorization code without exposing the client secret in the URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createApi().exchangeCode('oauth-code')).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(request.body).toBeInstanceOf(URLSearchParams);
    expect((request.body as URLSearchParams).get('client_secret')).toBe(
      'client-secret',
    );
    expect(url).not.toContain('client-secret');
  });

  it('signals an expired history cursor and sends threaded MIME replies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'sent-1', threadId: 'thread-1' }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    await expect(api.listHistory('access', 'old-history')).resolves.toBe(
      'expired',
    );
    await expect(
      api.sendMessage('access', { raw: 'mime-data', threadId: 'thread-1' }),
    ).resolves.toEqual({ id: 'sent-1', threadId: 'thread-1' });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      body: JSON.stringify({ raw: 'mime-data', threadId: 'thread-1' }),
      method: 'POST',
    });
  });
});
