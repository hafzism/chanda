export type WorkspaceRole = 'owner' | 'admin' | 'agent' | 'viewer';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  slug: string;
}

export interface WorkspaceMembership {
  role: WorkspaceRole;
  userId: string;
  workspaceId: string;
}

export interface TeamMemberSummary {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  joinedAt: Date;
  role: WorkspaceRole;
  userId: string;
}

export interface PendingInvitationSummary {
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  invitedByDisplayName: string | null;
  role: Exclude<WorkspaceRole, 'owner'>;
}

export interface CreatedInvitation extends PendingInvitationSummary {
  token: string;
}

export interface TeamOverview {
  invitations: PendingInvitationSummary[];
  members: TeamMemberSummary[];
}

export interface InvitationPreview {
  email: string;
  expiresAt: Date;
  id: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export type InvitationAcceptance =
  | { kind: 'accepted'; workspace: WorkspaceSummary }
  | {
      kind: 'email_mismatch' | 'expired' | 'missing' | 'revoked';
      workspace?: never;
    };

export interface WorkspaceRepository {
  create(input: {
    name: string;
    ownerUserId: string;
    slug: string;
    webPublicKey: string;
  }): Promise<WorkspaceSummary>;
  findMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership | null>;
  acceptInvitation(input: {
    email: string;
    tokenHash: string;
    userId: string;
  }): Promise<InvitationAcceptance>;
  createInvitation(input: {
    email: string;
    expiresAt: Date;
    invitedByUserId: string;
    role: Exclude<WorkspaceRole, 'owner'>;
    tokenHash: string;
    workspaceId: string;
  }): Promise<PendingInvitationSummary>;
  findInvitation(tokenHash: string): Promise<InvitationPreview | null>;
  getMember(
    workspaceId: string,
    userId: string,
  ): Promise<TeamMemberSummary | null>;
  listForUser(userId: string): Promise<WorkspaceSummary[]>;
  listTeam(workspaceId: string): Promise<TeamOverview>;
  removeMember(workspaceId: string, userId: string): Promise<boolean>;
  revokeInvitation(workspaceId: string, invitationId: string): Promise<boolean>;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: Exclude<WorkspaceRole, 'owner'>,
  ): Promise<TeamMemberSummary | null>;
}
