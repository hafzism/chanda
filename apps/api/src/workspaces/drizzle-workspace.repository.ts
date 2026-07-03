import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  channelConnections,
  desc,
  eq,
  gt,
  isNull,
  lt,
  ne,
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from '@suppline/database';

import { DatabaseService } from '../database/database.service';
import type {
  InvitationAcceptance,
  InvitationPreview,
  PendingInvitationSummary,
  TeamMemberSummary,
  TeamOverview,
  WorkspaceMembership,
  WorkspaceRepository,
  WorkspaceRole,
  WorkspaceSummary,
} from './workspace.types';

@Injectable()
export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: {
    name: string;
    ownerUserId: string;
    slug: string;
    webPublicKey: string;
  }): Promise<WorkspaceSummary> {
    return this.database.db.transaction(async (transaction) => {
      const [workspace] = await transaction
        .insert(workspaces)
        .values({
          createdByUserId: input.ownerUserId,
          name: input.name,
          slug: input.slug,
        })
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
        });

      if (!workspace) {
        throw new Error('Unable to create the workspace.');
      }

      await transaction.insert(workspaceMembers).values({
        role: 'owner',
        userId: input.ownerUserId,
        workspaceId: workspace.id,
      });
      await transaction.insert(channelConnections).values({
        kind: 'web',
        name: 'Website chat',
        publicKey: input.webPublicKey,
        status: 'active',
        workspaceId: workspace.id,
      });

      return { ...workspace, role: 'owner' };
    });
  }

  async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    return this.database.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: workspaceMembers.role,
        slug: workspaces.slug,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(workspaces.name);
  }

  async findMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership | null> {
    const [membership] = await this.database.db
      .select({
        role: workspaceMembers.role,
        userId: workspaceMembers.userId,
        workspaceId: workspaceMembers.workspaceId,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    return membership ?? null;
  }

  async listTeam(workspaceId: string): Promise<TeamOverview> {
    const [members, invitations] = await Promise.all([
      this.database.db
        .select({
          avatarUrl: users.avatarUrl,
          displayName: users.displayName,
          email: users.email,
          joinedAt: workspaceMembers.joinedAt,
          role: workspaceMembers.role,
          userId: users.id,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .orderBy(asc(users.email)),
      this.database.db
        .select({
          createdAt: workspaceInvitations.createdAt,
          email: workspaceInvitations.email,
          expiresAt: workspaceInvitations.expiresAt,
          id: workspaceInvitations.id,
          invitedByDisplayName: users.displayName,
          role: workspaceInvitations.role,
        })
        .from(workspaceInvitations)
        .innerJoin(users, eq(workspaceInvitations.invitedByUserId, users.id))
        .where(
          and(
            eq(workspaceInvitations.workspaceId, workspaceId),
            isNull(workspaceInvitations.acceptedAt),
            isNull(workspaceInvitations.revokedAt),
            gt(workspaceInvitations.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(workspaceInvitations.createdAt)),
    ]);

    return {
      invitations: invitations as PendingInvitationSummary[],
      members,
    };
  }

  async getMember(
    workspaceId: string,
    userId: string,
  ): Promise<TeamMemberSummary | null> {
    const [member] = await this.database.db
      .select({
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
        email: users.email,
        joinedAt: workspaceMembers.joinedAt,
        role: workspaceMembers.role,
        userId: users.id,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    return member ?? null;
  }

  async createInvitation(input: {
    email: string;
    expiresAt: Date;
    invitedByUserId: string;
    role: Exclude<WorkspaceRole, 'owner'>;
    tokenHash: string;
    workspaceId: string;
  }): Promise<PendingInvitationSummary> {
    return this.database.db.transaction(async (transaction) => {
      const now = new Date();
      await transaction
        .update(workspaceInvitations)
        .set({ revokedAt: now })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, input.workspaceId),
            eq(workspaceInvitations.email, input.email),
            isNull(workspaceInvitations.acceptedAt),
            isNull(workspaceInvitations.revokedAt),
            lt(workspaceInvitations.expiresAt, now),
          ),
        );

      const [invitation] = await transaction
        .insert(workspaceInvitations)
        .values(input)
        .returning({
          createdAt: workspaceInvitations.createdAt,
          email: workspaceInvitations.email,
          expiresAt: workspaceInvitations.expiresAt,
          id: workspaceInvitations.id,
          role: workspaceInvitations.role,
        });
      if (!invitation) throw new Error('Unable to create invitation.');
      return {
        ...invitation,
        invitedByDisplayName: null,
      } as PendingInvitationSummary;
    });
  }

  async findInvitation(tokenHash: string): Promise<InvitationPreview | null> {
    const [invitation] = await this.database.db
      .select({
        email: workspaceInvitations.email,
        expiresAt: workspaceInvitations.expiresAt,
        id: workspaceInvitations.id,
        role: workspaceInvitations.role,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
      })
      .from(workspaceInvitations)
      .innerJoin(
        workspaces,
        eq(workspaceInvitations.workspaceId, workspaces.id),
      )
      .where(
        and(
          eq(workspaceInvitations.tokenHash, tokenHash),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          gt(workspaceInvitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return (invitation as InvitationPreview | undefined) ?? null;
  }

  async acceptInvitation(input: {
    email: string;
    tokenHash: string;
    userId: string;
  }): Promise<InvitationAcceptance> {
    return this.database.db.transaction(async (transaction) => {
      const [invitation] = await transaction
        .select({
          acceptedAt: workspaceInvitations.acceptedAt,
          email: workspaceInvitations.email,
          expiresAt: workspaceInvitations.expiresAt,
          id: workspaceInvitations.id,
          revokedAt: workspaceInvitations.revokedAt,
          role: workspaceInvitations.role,
          workspaceId: workspaces.id,
          workspaceName: workspaces.name,
          workspaceSlug: workspaces.slug,
        })
        .from(workspaceInvitations)
        .innerJoin(
          workspaces,
          eq(workspaceInvitations.workspaceId, workspaces.id),
        )
        .where(eq(workspaceInvitations.tokenHash, input.tokenHash))
        .limit(1)
        .for('update');
      if (!invitation) return { kind: 'missing' };
      if (invitation.revokedAt) return { kind: 'revoked' };
      if (invitation.expiresAt <= new Date()) return { kind: 'expired' };
      if (invitation.email.toLowerCase() !== input.email.toLowerCase()) {
        return { kind: 'email_mismatch' };
      }

      const [existing] = await transaction
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, invitation.workspaceId),
            eq(workspaceMembers.userId, input.userId),
          ),
        )
        .limit(1);
      if (invitation.acceptedAt && !existing) return { kind: 'revoked' };
      if (!existing) {
        await transaction.insert(workspaceMembers).values({
          role: invitation.role,
          userId: input.userId,
          workspaceId: invitation.workspaceId,
        });
      }
      if (!invitation.acceptedAt) {
        await transaction
          .update(workspaceInvitations)
          .set({ acceptedAt: new Date() })
          .where(eq(workspaceInvitations.id, invitation.id));
      }
      return {
        kind: 'accepted',
        workspace: {
          id: invitation.workspaceId,
          name: invitation.workspaceName,
          role: existing?.role ?? invitation.role,
          slug: invitation.workspaceSlug,
        },
      };
    });
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
  ): Promise<boolean> {
    const [revoked] = await this.database.db
      .update(workspaceInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(workspaceInvitations.id, invitationId),
          eq(workspaceInvitations.workspaceId, workspaceId),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
        ),
      )
      .returning({ id: workspaceInvitations.id });
    return Boolean(revoked);
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: Exclude<WorkspaceRole, 'owner'>,
  ): Promise<TeamMemberSummary | null> {
    const [updated] = await this.database.db
      .update(workspaceMembers)
      .set({ role })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          ne(workspaceMembers.role, 'owner'),
        ),
      )
      .returning({ userId: workspaceMembers.userId });
    return updated ? this.getMember(workspaceId, userId) : null;
  }

  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const [removed] = await this.database.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          ne(workspaceMembers.role, 'owner'),
        ),
      )
      .returning({ userId: workspaceMembers.userId });
    return Boolean(removed);
  }
}
