import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

import type { IdentityVerifier, VerifiedIdentity } from './auth.types';

const FIREBASE_APP_NAME = 'suppline-api';

@Injectable()
export class FirebaseIdentityVerifier implements IdentityVerifier {
  private auth: Auth | null = null;

  async verifyIdToken(idToken: string): Promise<VerifiedIdentity> {
    try {
      const decodedToken = await this.getAuth().verifyIdToken(idToken, true);
      const displayName =
        typeof decodedToken.name === 'string' ? decodedToken.name : null;

      return {
        avatarUrl: decodedToken.picture ?? null,
        displayName,
        email: decodedToken.email ?? null,
        emailVerified: decodedToken.email_verified === true,
        firebaseUid: decodedToken.uid,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new UnauthorizedException('The Firebase ID token is invalid.');
    }
  }

  private getAuth(): Auth {
    if (this.auth) {
      return this.auth;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new ServiceUnavailableException(
        'Firebase authentication is not configured on the API.',
      );
    }

    const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
    const app: App =
      existingApp ??
      initializeApp(
        {
          credential: cert({ clientEmail, privateKey, projectId }),
          projectId,
        },
        FIREBASE_APP_NAME,
      );

    this.auth = getAuth(app);
    return this.auth;
  }
}
