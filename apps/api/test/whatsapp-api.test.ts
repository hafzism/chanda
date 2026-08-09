import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WhatsAppCloudApiService } from '../src/support/whatsapp/whatsapp-api.service';

describe('WhatsAppCloudApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('verifies a WhatsApp phone identity with a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          display_phone_number: '+1 555 0100',
          id: '123456789',
          verified_name: 'Chanda Test',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = new WhatsAppCloudApiService(
      new ConfigService({ META_GRAPH_API_VERSION: 'v24.0' }),
    );

    await expect(api.getPhone('secret-token', '123456789')).resolves.toEqual({
      displayPhoneNumber: '+1 555 0100',
      id: '123456789',
      verifiedName: 'Chanda Test',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v24.0/123456789?fields=id,display_phone_number,verified_name',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret-token' },
        method: 'GET',
      }),
    );
  });

  it('sends a plain-text message with preview disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: 'wamid.sent-1' }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = new WhatsAppCloudApiService(new ConfigService());

    await expect(
      api.sendText('token', '123456789', '919876543210', 'Order shipped.'),
    ).resolves.toEqual({ messageId: 'wamid.sent-1' });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        text: { body: 'Order shipped.', preview_url: false },
        to: '919876543210',
        type: 'text',
      }),
      method: 'POST',
    });
  });
});
