import { describe, expect, it } from 'vitest';

import { createWidgetEmbedCode, normalizeWebsiteOrigin } from '../lib/channels';

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
