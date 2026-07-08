import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginGmailOAuth,
  connectWhatsAppChannel,
  connectTelegramChannel,
  connectMetaMessagingChannel,
  createWidgetEmbedCode,
  disconnectGmailChannel,
  disconnectMetaMessagingChannel,
  disconnectTelegramChannel,
  disconnectWhatsAppChannel,
  normalizeWebsiteOrigin,
  syncGmailChannel,
} from '../lib/channels';

afterEach(() => vi.unstubAllGlobals());

describe('normalizeWebsiteOrigin', () => {
  it('normalizes exact HTTP origins and removes a trailing slash', () => {
    expect(normalizeWebsiteOrigin(' https://Support.Example.com/ ')).toBe(
      'https://support.example.com',
    );
    expect(normalizeWebsiteOrigin('http://localhost:3000')).toBe(
      'http://localhost:3000',
    );
  });

  it('rejects paths, credentials, and unsupported schemes', () => {
    for (const value of [
      'https://example.com/widget',
      'https://user@example.com',
      'ftp://example.com',
    ]) {
      expect(() => normalizeWebsiteOrigin(value)).toThrow(
        'Enter only a website origin',
      );
    }
  });
});

describe('createWidgetEmbedCode', () => {
  it('creates an executable snippet with separate script and API origins', () => {
    expect(
      createWidgetEmbedCode({
        apiOrigin: 'https://api.suppline.example',
        publicKey: 'pub_123456789012345678901234',
        scriptOrigin: 'https://app.suppline.example',
      }),
    ).toBe(
      '<script src="https://app.suppline.example/widget.js" data-api-origin="https://api.suppline.example" data-public-key="pub_123456789012345678901234" defer></script>',
    );
  });
});

describe('Telegram channel operations', () => {
  it('sends the write-only bot token only during connection', async () => {
    const connected = {
      botUsername: 'suppline_help_bot',
      id: 'connection-1',
      status: 'active',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(connected), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await connectTelegramChannel('workspace-1', '123:secret');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/channels/telegram',
      expect.objectContaining({
        body: JSON.stringify({ botToken: '123:secret' }),
        method: 'POST',
      }),
    );
  });

  it('handles a successful no-content disconnect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      disconnectTelegramChannel('workspace-1'),
    ).resolves.toBeUndefined();
  });
});

describe('Gmail channel operations', () => {
  it('starts OAuth without accepting browser-provided credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          authorizationUrl: 'https://accounts.google.com/oauth',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(beginGmailOAuth('workspace-1')).resolves.toEqual({
      authorizationUrl: 'https://accounts.google.com/oauth',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/channels/gmail/oauth',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('runs explicit synchronization and handles a no-content disconnect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ imported: 2, syncedAt: '2026-07-14T00:00:00.000Z' }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncGmailChannel('workspace-1')).resolves.toMatchObject({
      imported: 2,
    });
    await expect(
      disconnectGmailChannel('workspace-1'),
    ).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});

describe('WhatsApp channel operations', () => {
  it('sends write-only Meta credentials only during connection', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          displayPhoneNumber: '+1 555 0100',
          id: 'connection-1',
          status: 'active',
          verifyToken: 'one-time-token',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await connectWhatsAppChannel('workspace-1', {
      accessToken: 'meta-access-token',
      appSecret: 'a'.repeat(32),
      phoneNumberId: '123456789',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/channels/whatsapp',
      expect.objectContaining({
        body: JSON.stringify({
          accessToken: 'meta-access-token',
          appSecret: 'a'.repeat(32),
          phoneNumberId: '123456789',
        }),
        method: 'POST',
      }),
    );
  });

  it('handles a no-content WhatsApp disconnect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      disconnectWhatsAppChannel('workspace-1'),
    ).resolves.toBeUndefined();
  });
});

describe('Meta social messaging operations', () => {
  it('sends write-only Page credentials to the selected channel endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assetId: '1784140000',
          id: 'connection-1',
          kind: 'instagram',
          status: 'active',
          verifyToken: 'one-time-token',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await connectMetaMessagingChannel('workspace-1', 'instagram', {
      appSecret: 'a'.repeat(32),
      assetId: '1784140000',
      pageAccessToken: 'page-access-token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/channels/meta/instagram',
      expect.objectContaining({
        body: JSON.stringify({
          appSecret: 'a'.repeat(32),
          assetId: '1784140000',
          pageAccessToken: 'page-access-token',
        }),
        method: 'POST',
      }),
    );
  });

  it('disconnects Facebook Messenger without expecting a body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      disconnectMetaMessagingChannel('workspace-1', 'facebook'),
    ).resolves.toBeUndefined();
  });
});
