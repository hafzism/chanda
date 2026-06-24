import { describe, expect, it } from 'vitest';

import {
  createSessionToken,
  hashSessionToken,
  readCookie,
} from '../src/auth/session-token';

describe('session token utilities', () => {
  it('creates high-entropy URL-safe tokens and stores only a stable hash', () => {
    const firstToken = createSessionToken();
    const secondToken = createSessionToken();

    expect(firstToken).toHaveLength(43);
    expect(firstToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(firstToken).not.toBe(secondToken);
    expect(hashSessionToken(firstToken)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(firstToken)).toBe(hashSessionToken(firstToken));
  });

  it('reads only the requested cookie and rejects malformed values', () => {
    expect(
      readCookie(
        'theme=warm; suppline_session=secure-token',
        'suppline_session',
      ),
    ).toBe('secure-token');
    expect(
      readCookie('suppline_session=hello%20there', 'suppline_session'),
    ).toBe('hello there');
    expect(
      readCookie('suppline_session=%E0%A4%A', 'suppline_session'),
    ).toBeNull();
    expect(readCookie(undefined, 'suppline_session')).toBeNull();
  });
});
