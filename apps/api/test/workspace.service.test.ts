import {
  ConflictException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { WorkspaceService } from '../src/workspaces/workspace.service';
import type { WorkspaceRepository } from '../src/workspaces/workspace.types';

describe('WorkspaceService', () => {
  let createMock: MockedFunction<WorkspaceRepository['create']>;
  let listMock: MockedFunction<WorkspaceRepository['listForUser']>;
  let membershipMock: MockedFunction<WorkspaceRepository['findMembership']>;
  let acceptInvitationMock: MockedFunction<
    WorkspaceRepository['acceptInvitation']
  >;
  let createInvitationMock: MockedFunction<
    WorkspaceRepository['createInvitation']
  >;
  let findInvitationMock: MockedFunction<WorkspaceRepository['findInvitation']>;
  let listTeamMock: MockedFunction<WorkspaceRepository['listTeam']>;
  let updateMemberRoleMock: MockedFunction<
    WorkspaceRepository['updateMemberRole']
  >;
  let service: WorkspaceService;

  beforeEach(() => {
    createMock = vi.fn<WorkspaceRepository['create']>();
    listMock = vi.fn<WorkspaceRepository['listForUser']>();
    membershipMock = vi.fn<WorkspaceRepository['findMembership']>();
    acceptInvitationMock = vi.fn<WorkspaceRepository['acceptInvitation']>();
    createInvitationMock = vi.fn<WorkspaceRepository['createInvitation']>();
    findInvitationMock = vi.fn<WorkspaceRepository['findInvitation']>();
    listTeamMock = vi
      .fn<WorkspaceRepository['listTeam']>()
      .mockResolvedValue({ invitations: [], members: [] });
    updateMemberRoleMock = vi.fn<WorkspaceRepository['updateMemberRole']>();
    service = new WorkspaceService({
      acceptInvitation: acceptInvitationMock,
      create: createMock,
      createInvitation: createInvitationMock,
      findInvitation: findInvitationMock,
      findMembership: membershipMock,
      getMember: vi.fn(),
      listForUser: listMock,
      listTeam: listTeamMock,
      removeMember: vi.fn(),
      revokeInvitation: vi.fn(),
      updateMemberRole: updateMemberRoleMock,
    });
  });

  it('creates a normalized workspace owned by the authenticated user', async () => {
    createMock.mockResolvedValue({
      id: 'workspace-1',
      name: 'Acme Support',
      role: 'owner',
      slug: 'acme-support',
    });

    await expect(
      service.create('user-1', {
        name: '  Acme Support  ',
        slug: 'acme-support',
      }),
    ).resolves.toMatchObject({ role: 'owner' });
    const input = createMock.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      name: 'Acme Support',
      ownerUserId: 'user-1',
      slug: 'acme-support',
    });
    expect(input?.webPublicKey).toMatch(/^pub_[A-Za-z0-9_-]{24}$/);
  });

  it('turns a unique slug violation into a useful conflict response', async () => {
    createMock.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: '23505' }),
    );

    await expect(
      service.create('user-1', { name: 'Acme', slug: 'acme' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists only workspaces returned for the authenticated user', async () => {
    listMock.mockResolvedValue([]);

    await expect(service.listForUser('user-1')).resolves.toEqual([]);
    expect(listMock).toHaveBeenCalledWith('user-1');
  });

  it('creates a one-time seven-day invitation for a workspace owner', async () => {
    membershipMock.mockResolvedValue({
      role: 'owner',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
    createInvitationMock.mockImplementation((input) =>
      Promise.resolve({
        createdAt: new Date(),
        email: input.email,
        expiresAt: input.expiresAt,
        id: 'invitation-1',
        invitedByDisplayName: null,
        role: input.role,
      }),
    );

    const invitation = await service.createInvitation(
      'workspace-1',
      'user-1',
      '  AGENT@example.com ',
      'agent',
    );

    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createInvitationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'agent@example.com',
        invitedByUserId: 'user-1',
        role: 'agent',
      }),
    );
    expect(createInvitationMock.mock.calls[0]?.[0].tokenHash).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it('prevents an admin from creating another admin', async () => {
    membershipMock.mockResolvedValue({
      role: 'admin',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    await expect(
      service.createInvitation(
        'workspace-1',
        'user-1',
        'admin@example.com',
        'admin',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it('requires the signed-in verified email to match an invitation', async () => {
    findInvitationMock.mockResolvedValue({
      email: 'invitee@example.com',
      expiresAt: new Date(Date.now() + 60_000),
      id: 'invitation-1',
      role: 'agent',
      workspaceId: 'workspace-1',
      workspaceName: 'Acme',
      workspaceSlug: 'acme',
    });

    await expect(
      service.previewInvitation('a'.repeat(43), 'other@example.com'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns an explicit gone response for an expired or revoked invitation', async () => {
    acceptInvitationMock.mockResolvedValue({ kind: 'expired' });

    await expect(
      service.acceptInvitation('a'.repeat(43), 'user-1', 'invitee@example.com'),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('enforces owner-only role changes inside the service boundary', async () => {
    membershipMock.mockResolvedValue({
      role: 'admin',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    await expect(
      service.updateMemberRole('workspace-1', 'user-2', 'viewer', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMemberRoleMock).not.toHaveBeenCalled();
  });
});
