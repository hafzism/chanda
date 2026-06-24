import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';

import { SESSION_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import { readCookie } from './session-token';
import type { SessionRecord } from './auth.types';

const AUTH_SESSION: unique symbol = Symbol('AUTH_SESSION');

type AuthenticatedRequest = Request & {
  [AUTH_SESSION]?: SessionRecord;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);

    if (!token) {
      throw new UnauthorizedException('A Suppline session is required.');
    }

    request[AUTH_SESSION] = await this.authService.readSession(token);
    return true;
  }
}

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionRecord => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = request[AUTH_SESSION];

    if (!session) {
      throw new UnauthorizedException('A Suppline session is required.');
    }

    return session;
  },
);
