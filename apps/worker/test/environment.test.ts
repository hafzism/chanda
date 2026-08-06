import { describe, expect, it } from 'vitest';

import { validateWorkerEnvironment } from '../src/environment';

describe('worker environment validation', () => {
  it('allows local defaults but validates configured URLs', () => {
    expect(validateWorkerEnvironment({ NODE_ENV: 'development' })).toEqual({
      NODE_ENV: 'development',
    });
    expect(() =>
      validateWorkerEnvironment({ DATABASE_URL: 'mysql://database' }),
    ).toThrow('DATABASE_URL must use postgres: or postgresql:.');
  });

  it('requires every worker dependency in production', () => {
    expect(() => validateWorkerEnvironment({ NODE_ENV: 'production' })).toThrow(
      /DATABASE_URL.*REDIS_URL.*AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY/,
    );
  });

  it('rejects non-canonical base64 encryption keys', () => {
    expect(() =>
      validateWorkerEnvironment({
        AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY: `${Buffer.alloc(32, 1).toString('base64')}!ignored`,
      }),
    ).toThrow(/base64-encoded 32-byte key/);
  });
});
