import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  connectTelegramChannel,
  createWidgetEmbedCode,
  disconnectTelegramChannel,
  normalizeWebsiteOrigin,
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
