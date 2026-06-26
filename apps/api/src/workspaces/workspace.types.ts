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
  listForUser(userId: string): Promise<WorkspaceSummary[]>;
}
