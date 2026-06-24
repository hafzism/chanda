export type WorkspaceRole = 'owner' | 'admin' | 'agent' | 'viewer';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  slug: string;
}

export interface WorkspaceRepository {
  create(input: {
    name: string;
    ownerUserId: string;
    slug: string;
  }): Promise<WorkspaceSummary>;
  listForUser(userId: string): Promise<WorkspaceSummary[]>;
}
