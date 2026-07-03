import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CreateWorkspaceDto } from './dto/create-workspace.dto';
import type {
  CreatedInvitation,
  InvitationPreview,
  TeamMemberSummary,
  TeamOverview,
  WorkspaceMembership,
  WorkspaceRepository,
  WorkspaceRole,
  WorkspaceSummary,
} from './workspace.types';

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

function invitationHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function assertInvitationToken(token: string): void {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new NotFoundException('Invitation not found.');
  }
}

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly repository: WorkspaceRepository,
  ) {}

  async create(
    ownerUserId: string,
    input: CreateWorkspaceDto,
  ): Promise<WorkspaceSummary> {
    try {
      return await this.repository.create({
        name: input.name.trim(),
        ownerUserId,
        slug: input.slug,
        webPublicKey: `pub_${randomBytes(18).toString('base64url')}`,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'That workspace URL is already in use. Choose another one.',
        );
      }

      throw error;
    }
  }

  listForUser(userId: string): Promise<WorkspaceSummary[]> {
    return this.repository.listForUser(userId);
  }

  findMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership | null> {
    return this.repository.findMembership(userId, workspaceId);
  }

  async listTeam(workspaceId: string, userId: string): Promise<TeamOverview> {
    const membership = await this.requireMembership(userId, workspaceId);
    const team = await this.repository.listTeam(workspaceId);
    return membership.role === 'owner' || membership.role === 'admin'
      ? team
      : { invitations: [], members: team.members };
  }

  async createInvitation(
    workspaceId: string,
    userId: string,
    email: string,
    role: Exclude<WorkspaceRole, 'owner'>,
  ): Promise<CreatedInvitation> {
    const actor = await this.requireManager(userId, workspaceId);
    if (actor.role === 'admin' && role === 'admin') {
      throw new ForbiddenException(
        'Only the workspace owner can invite admins.',
      );
    }
    const normalizedEmail = email.trim().toLowerCase();
    const team = await this.repository.listTeam(workspaceId);
    if (team.members.some((member) => member.email === normalizedEmail)) {
      throw new ConflictException('That person is already a workspace member.');
    }
    const token = randomBytes(32).toString('base64url');
    try {
      const invitation = await this.repository.createInvitation({
        email: normalizedEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedByUserId: userId,
        role,
        tokenHash: invitationHash(token),
        workspaceId,
      });
      return { ...invitation, token };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A pending invitation already exists for that email.',
        );
      }
      throw error;
    }
  }

  async previewInvitation(
    token: string,
    signedInEmail: string,
  ): Promise<InvitationPreview> {
    assertInvitationToken(token);
    const invitation = await this.repository.findInvitation(
      invitationHash(token),
    );
    if (!invitation)
      throw new GoneException('This invitation is no longer active.');
    if (invitation.email.toLowerCase() !== signedInEmail.toLowerCase()) {
      throw new ForbiddenException(
        `Sign in with ${invitation.email} to accept this invitation.`,
      );
    }
    return invitation;
  }

  async acceptInvitation(
    token: string,
    userId: string,
    email: string,
  ): Promise<WorkspaceSummary> {
    assertInvitationToken(token);
    const result = await this.repository.acceptInvitation({
      email,
      tokenHash: invitationHash(token),
      userId,
    });
    if (result.kind === 'accepted') return result.workspace;
    if (result.kind === 'email_mismatch') {
      throw new ForbiddenException(
        'This invitation belongs to a different verified email address.',
      );
    }
    if (result.kind === 'expired' || result.kind === 'revoked') {
      throw new GoneException('This invitation is no longer active.');
    }
    throw new NotFoundException('Invitation not found.');
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    userId: string,
  ): Promise<void> {
    const actor = await this.requireManager(userId, workspaceId);
    const invitation = (
      await this.repository.listTeam(workspaceId)
    ).invitations.find((item) => item.id === invitationId);
    if (!invitation) throw new NotFoundException('Invitation not found.');
    if (actor.role === 'admin' && invitation.role === 'admin') {
      throw new ForbiddenException(
        'Only the workspace owner can revoke an admin invitation.',
      );
    }
    if (!(await this.repository.revokeInvitation(workspaceId, invitationId))) {
      throw new NotFoundException('Invitation not found.');
    }
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    role: Exclude<WorkspaceRole, 'owner'>,
    actorUserId: string,
  ): Promise<TeamMemberSummary> {
    const actor = await this.requireMembership(actorUserId, workspaceId);
    if (actor.role !== 'owner') {
      throw new ForbiddenException(
        'Only the workspace owner can change member roles.',
      );
    }
    const member = await this.repository.updateMemberRole(
      workspaceId,
      targetUserId,
      role,
    );
    if (!member) {
      throw new BadRequestException(
        'The workspace owner role cannot be changed.',
      );
    }
    return member;
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    actorUserId: string,
  ): Promise<void> {
    const actor = await this.requireManager(actorUserId, workspaceId);
    const target = await this.repository.getMember(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Team member not found.');
    if (target.role === 'owner') {
      throw new BadRequestException('The workspace owner cannot be removed.');
    }
    if (actor.role === 'admin' && target.role === 'admin') {
      throw new ForbiddenException(
        'Only the workspace owner can remove an admin.',
      );
    }
    if (!(await this.repository.removeMember(workspaceId, targetUserId))) {
      throw new NotFoundException('Team member not found.');
    }
  }

  private async requireMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership> {
    const membership = await this.repository.findMembership(
      userId,
      workspaceId,
    );
    if (!membership) throw new ForbiddenException('Workspace access denied.');
    return membership;
  }

  private async requireManager(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership> {
    const membership = await this.requireMembership(userId, workspaceId);
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new ForbiddenException(
        'Your workspace role does not allow this action.',
      );
    }
    return membership;
  }
}
