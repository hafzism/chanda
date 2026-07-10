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
      /DATABASE_URL.*REDIS_URL.*GEMINI_API_KEY/,
    );
  });
});
