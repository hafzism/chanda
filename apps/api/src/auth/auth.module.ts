import { Module } from '@nestjs/common';

import { AUTH_REPOSITORY, IDENTITY_VERIFIER } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DrizzleAuthRepository } from './drizzle-auth.repository';
import { FirebaseIdentityVerifier } from './firebase-identity.verifier';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionGuard,
    { provide: AUTH_REPOSITORY, useClass: DrizzleAuthRepository },
    { provide: IDENTITY_VERIFIER, useClass: FirebaseIdentityVerifier },
  ],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
