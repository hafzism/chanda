import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

describe('auth session endpoint', () => {
  const expiresAt = new Date('2026-08-12T00:00:00.000Z');
  const user = {
    avatarUrl: null,
    displayName: 'Hafeez',
    email: 'hafeez@example.com',
    id: 'user-1',
  };
  const authService = {
    exchangeIdToken: vi.fn(),
    readSession: vi.fn(),
    revokeSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authService.exchangeIdToken.mockResolvedValue({
      expiresAt,
      token: 'suppline-browser-session',
      user,
    });
    authService.readSession.mockResolvedValue({ expiresAt, user });
    authService.revokeSession.mockResolvedValue(undefined);
  });

  async function createApp() {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
    return app;
  }

  it('sets an HttpOnly session cookie without returning the secret', async () => {
    const app = await createApp();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .post('/v1/auth/session')
      .set('user-agent', 'test-browser')
      .send({ idToken: 'a-valid-firebase-id-token' })
      .expect(201);

    expect(response.body).toEqual({
      expiresAt: expiresAt.toISOString(),
      user,
    });
    expect(response.body).not.toHaveProperty('token');
    expect(response.headers['set-cookie']?.[0]).toContain(
      'suppline_session=suppline-browser-session',
    );
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
    expect(authService.exchangeIdToken).toHaveBeenCalledWith(
      'a-valid-firebase-id-token',
      'test-browser',
    );

    await app.close();
  });

  it('reads and revokes a session from its cookie', async () => {
    const app = await createApp();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const cookie = 'suppline_session=suppline-browser-session';

    await request(server)
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200)
      .expect({ expiresAt: expiresAt.toISOString(), user });
    expect(authService.readSession).toHaveBeenCalledWith(
      'suppline-browser-session',
    );

    const revokeResponse = await request(server)
      .delete('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(204);
    expect(authService.revokeSession).toHaveBeenCalledWith(
      'suppline-browser-session',
    );
    expect(revokeResponse.headers['set-cookie']?.[0]).toContain(
      'suppline_session=',
    );

    await app.close();
  });

  it('rejects malformed session creation requests', async () => {
    const app = await createApp();
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .post('/v1/auth/session')
      .send({ idToken: 'short', unexpected: true })
      .expect(400);
    expect(authService.exchangeIdToken).not.toHaveBeenCalled();

    await app.close();
  });
});
