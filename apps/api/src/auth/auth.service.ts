import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import {
  AUTH_REPOSITORY,
  IDENTITY_VERIFIER,
  SESSION_LIFETIME_MS,
} from './auth.constants';
import { createSessionToken, hashSessionToken } from './session-token';
import type {
  AuthRepository,
  IdentityVerifier,
  IssuedSession,
  SessionRecord,
} from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(IDENTITY_VERIFIER)
    private readonly identityVerifier: IdentityVerifier,
    @Inject(AUTH_REPOSITORY)
    private readonly repository: AuthRepository,
  ) {}

  async exchangeIdToken(
    idToken: string,
    userAgent: string | null,
  ): Promise<IssuedSession> {
    const identity = await this.identityVerifier.verifyIdToken(idToken);

    if (!identity.email || !identity.emailVerified) {
      throw new UnauthorizedException(
        'A verified email address is required to sign in.',
      );
    }

    const user = await this.repository.upsertUser({
      ...identity,
      email: identity.email,
    });
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    await this.repository.createSession({
      expiresAt,
      tokenHash: hashSessionToken(token),
      userAgent,
      userId: user.id,
    });

    return { expiresAt, token, user };
  }

  async readSession(token: string): Promise<SessionRecord> {
    const session = await this.repository.findActiveSession(
      hashSessionToken(token),
    );

    if (!session) {
      throw new UnauthorizedException('The Suppline session is not valid.');
    }

    return session;
  }

  async revokeSession(token: string): Promise<void> {
    await this.repository.revokeSession(hashSessionToken(token), new Date());
  }
}
