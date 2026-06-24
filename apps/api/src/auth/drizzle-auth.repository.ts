import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sessions, users } from '@suppline/database';

import { DatabaseService } from '../database/database.service';
import type {
  AuthRepository,
  AuthUser,
  SessionRecord,
  VerifiedIdentity,
} from './auth.types';

@Injectable()
export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsertUser(
    identity: VerifiedIdentity & { email: string },
  ): Promise<AuthUser> {
    const now = new Date();
    const [user] = await this.database.db
      .insert(users)
      .values({
        avatarUrl: identity.avatarUrl,
        displayName: identity.displayName,
        email: identity.email,
        firebaseUid: identity.firebaseUid,
        lastSignedInAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          avatarUrl: identity.avatarUrl,
          displayName: identity.displayName,
          email: identity.email,
          lastSignedInAt: now,
          updatedAt: now,
        },
        target: users.firebaseUid,
      })
      .returning({
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
        email: users.email,
        id: users.id,
      });

    if (!user) {
      throw new Error('Unable to persist the authenticated user.');
    }

    return user;
  }

  async createSession(input: {
    expiresAt: Date;
    tokenHash: string;
    userAgent: string | null;
    userId: string;
  }): Promise<void> {
    await this.database.db.insert(sessions).values(input);
  }

  async findActiveSession(tokenHash: string): Promise<SessionRecord | null> {
    const [session] = await this.database.db
      .select({
        expiresAt: sessions.expiresAt,
        user: {
          avatarUrl: users.avatarUrl,
          displayName: users.displayName,
          email: users.email,
          id: users.id,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  async revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.database.db
      .update(sessions)
      .set({ revokedAt })
      .where(
        and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)),
      );
  }
}
