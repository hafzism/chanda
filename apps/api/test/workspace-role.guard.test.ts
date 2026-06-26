import {
  Controller,
  Get,
  type INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service';
import { SessionGuard } from '../src/auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../src/workspaces/workspace-role.guard';
import { WorkspaceService } from '../src/workspaces/workspace.service';

@Controller('test/:workspaceId')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
class GuardTestController {
  @Get()
  @WorkspaceRoles('owner', 'admin')
  read() {
    return { allowed: true };
  }
}

describe('WorkspaceRoleGuard', () => {
  const readSessionMock = vi.fn();
  const findMembershipMock = vi.fn();
  let app: INestApplication;

  beforeEach(async () => {
    vi.clearAllMocks();
    readSessionMock.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        avatarUrl: null,
        displayName: 'Owner',
        email: 'owner@example.com',
        id: 'user-1',
      },
    });
    findMembershipMock.mockResolvedValue({
      role: 'owner',
      userId: 'user-1',
      workspaceId: 'b31dbd2e-49fe-4cd7-9333-98e68a472c40',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [GuardTestController],
      providers: [
        SessionGuard,
        WorkspaceRoleGuard,
        { provide: AuthService, useValue: { readSession: readSessionMock } },
        {
          provide: WorkspaceService,
          useValue: { findMembership: findMembershipMock },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('allows an owner of the route workspace', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/test/b31dbd2e-49fe-4cd7-9333-98e68a472c40')
      .set('Cookie', 'suppline_session=valid-session')
      .expect(200)
      .expect({ allowed: true });
    expect(findMembershipMock).toHaveBeenCalledWith(
      'user-1',
      'b31dbd2e-49fe-4cd7-9333-98e68a472c40',
    );

    await app.close();
  });

  it('rejects a role that cannot manage workspace knowledge', async () => {
    findMembershipMock.mockResolvedValue({
      role: 'viewer',
      userId: 'user-1',
      workspaceId: 'b31dbd2e-49fe-4cd7-9333-98e68a472c40',
    });
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/test/b31dbd2e-49fe-4cd7-9333-98e68a472c40')
      .set('Cookie', 'suppline_session=valid-session')
      .expect(403);

    await app.close();
  });
});
