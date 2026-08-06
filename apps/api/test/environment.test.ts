import { describe, expect, it } from 'vitest';

import { validateApiEnvironment } from '../src/config/environment';

describe('API environment validation', () => {
  it('allows an incomplete local development environment', () => {
    expect(validateApiEnvironment({ NODE_ENV: 'development' })).toEqual({
      NODE_ENV: 'development',
    });
  });

  it('reports every missing production value in one failure', () => {
    expect(() => validateApiEnvironment({ NODE_ENV: 'production' })).toThrow(
      /DATABASE_URL.*REDIS_URL.*WEB_APP_URL/,
    );
  });

  it('rejects malformed URLs, ports, and encryption keys', () => {
    expect(() => validateApiEnvironment({ API_PORT: '70000' })).toThrow(
      'API_PORT must be an integer from 1 to 65535.',
    );
    expect(() =>
      validateApiEnvironment({ REDIS_URL: 'https://redis' }),
    ).toThrow('REDIS_URL must use redis: or rediss:.');
    expect(() =>
      validateApiEnvironment({ CHANNEL_CREDENTIALS_ENCRYPTION_KEY: 'short' }),
    ).toThrow(/base64-encoded 32-byte key/);
    expect(() =>
      validateApiEnvironment({
        AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY: 'short',
      }),
    ).toThrow(/AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY/);
    expect(() =>
      validateApiEnvironment({
        AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY: `${Buffer.alloc(32, 1).toString('base64')}!ignored`,
      }),
    ).toThrow(/AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY/);
  });
});
