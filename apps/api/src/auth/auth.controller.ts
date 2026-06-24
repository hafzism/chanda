import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

import { SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { readCookie } from './session-token';

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    maxAge: SESSION_LIFETIME_MS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

function requireSessionToken(request: Request): string {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);

  if (!token) {
    throw new UnauthorizedException('A Suppline session is required.');
  }

  return token;
}

@Controller('v1/auth/session')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateSessionDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userAgent = request.get('user-agent')?.slice(0, 512) ?? null;
    const session = await this.authService.exchangeIdToken(
      body.idToken,
      userAgent,
    );

    response.cookie(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());

    return { expiresAt: session.expiresAt, user: session.user };
  }

  @Get()
  async read(@Req() request: Request) {
    return this.authService.readSession(requireSessionToken(request));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.revokeSession(requireSessionToken(request));
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  }
}
