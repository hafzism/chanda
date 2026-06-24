import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { AuthService } from '../src/auth/auth.service';
import type {
  AuthRepository,
  IdentityVerifier,
  VerifiedIdentity,
} from '../src/auth/auth.types';
import { hashSessionToken } from '../src/auth/session-token';

const verifiedIdentity: VerifiedIdentity = {
  avatarUrl: 'https://example.com/avatar.png',
  displayName: 'Hafeez',
  email: 'hafeez@example.com',
  emailVerified: true,
  firebaseUid: 'firebase-user-1',
};

describe('AuthService', () => {
  let identityVerifier: IdentityVerifier;
  let repository: AuthRepository;
  let service: AuthService;
  let verifyIdTokenMock: MockedFunction<IdentityVerifier['verifyIdToken']>;
  let createSessionMock: MockedFunction<AuthRepository['createSession']>;
  let findActiveSessionMock: MockedFunction<
    AuthRepository['findActiveSession']
  >;
  let revokeSessionMock: MockedFunction<AuthRepository['revokeSession']>;
  let upsertUserMock: MockedFunction<AuthRepository['upsertUser']>;

  beforeEach(() => {
    verifyIdTokenMock = vi
      .fn<IdentityVerifier['verifyIdToken']>()
      .mockResolvedValue(verifiedIdentity);
    createSessionMock = vi
      .fn<AuthRepository['createSession']>()
      .mockResolvedValue(undefined);
    findActiveSessionMock = vi
      .fn<AuthRepository['findActiveSession']>()
      .mockResolvedValue(null);
    revokeSessionMock = vi
      .fn<AuthRepository['revokeSession']>()
      .mockResolvedValue(undefined);
    upsertUserMock = vi.fn<AuthRepository['upsertUser']>().mockResolvedValue({
      avatarUrl: verifiedIdentity.avatarUrl,
      displayName: verifiedIdentity.displayName,
      email: 'hafeez@example.com',
      id: 'user-1',
    });
    identityVerifier = {
      verifyIdToken: verifyIdTokenMock,
    };
    repository = {
      createSession: createSessionMock,
      findActiveSession: findActiveSessionMock,
      revokeSession: revokeSessionMock,
      upsertUser: upsertUserMock,
    };
    service = new AuthService(identityVerifier, repository);
  });

  it('exchanges a verified Firebase identity for a hashed Suppline session', async () => {
    const issuedSession = await service.exchangeIdToken(
      'valid-firebase-token',
      'test-browser',
    );

    expect(verifyIdTokenMock).toHaveBeenCalledWith('valid-firebase-token');
    expect(upsertUserMock).toHaveBeenCalledWith(verifiedIdentity);
    expect(createSessionMock).toHaveBeenCalledWith({
      expiresAt: issuedSession.expiresAt,
      tokenHash: hashSessionToken(issuedSession.token),
      userAgent: 'test-browser',
      userId: 'user-1',
    });
    expect(issuedSession.token).toHaveLength(43);
  });

  it('rejects identities without a verified email address', async () => {
    verifyIdTokenMock.mockResolvedValue({
      ...verifiedIdentity,
      emailVerified: false,
    });

    await expect(
      service.exchangeIdToken('unverified-token', null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('resolves and revokes only hashes of browser session tokens', async () => {
    const storedSession = {
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        avatarUrl: null,
        displayName: 'Hafeez',
        email: 'hafeez@example.com',
        id: 'user-1',
      },
    };
    findActiveSessionMock.mockResolvedValue(storedSession);

    await expect(service.readSession('browser-secret')).resolves.toBe(
      storedSession,
    );
    expect(findActiveSessionMock).toHaveBeenCalledWith(
      hashSessionToken('browser-secret'),
    );

    await service.revokeSession('browser-secret');
    expect(revokeSessionMock).toHaveBeenCalledWith(
      hashSessionToken('browser-secret'),
      expect.any(Date),
    );
  });

  it('rejects unknown, expired, or revoked sessions', async () => {
    await expect(service.readSession('invalid-session')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
