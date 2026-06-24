export interface VerifiedIdentity {
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  firebaseUid: string;
}

export interface IdentityVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedIdentity>;
}

export interface AuthUser {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  id: string;
}

export interface SessionRecord {
  expiresAt: Date;
  user: AuthUser;
}

export interface AuthRepository {
  createSession(input: {
    expiresAt: Date;
    tokenHash: string;
    userAgent: string | null;
    userId: string;
  }): Promise<void>;
  findActiveSession(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;
  upsertUser(identity: VerifiedIdentity & { email: string }): Promise<AuthUser>;
}

export interface IssuedSession extends SessionRecord {
  token: string;
}
