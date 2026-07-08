import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MetaMessagingApiService } from '../src/support/meta/meta-messaging-api.service';

describe('MetaMessagingApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads an Instagram Professional account with a Page token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '1784140000',
          name: 'Suppline',
          username: 'suppline',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = new MetaMessagingApiService(
      new ConfigService({ META_GRAPH_API_VERSION: 'v24.0' }),
    );

    await expect(
      api.getAsset('instagram', 'page-token', '1784140000'),
    ).resolves.toEqual({
      id: '1784140000',
      name: 'Suppline',
      username: 'suppline',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v24.0/1784140000?fields=id,name,username',
      expect.objectContaining({
        headers: { Authorization: 'Bearer page-token' },
      }),
    );
  });

  it('sends a standard response to a scoped messaging identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message_id: 'm_mid.sent-1' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = new MetaMessagingApiService(new ConfigService());

    await expect(
      api.sendText(
        'facebook',
        'page-token',
        'page-1',
        'psid-1',
        'Order shipped.',
      ),
    ).resolves.toEqual({ messageId: 'm_mid.sent-1' });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        message: { text: 'Order shipped.' },
        messaging_type: 'RESPONSE',
        recipient: { id: 'psid-1' },
      }),
      method: 'POST',
    });
  });
});
