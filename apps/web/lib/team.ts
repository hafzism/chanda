export type WorkspaceRole = 'owner' | 'admin' | 'agent' | 'viewer';

export interface TeamMember {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  joinedAt: string;
  role: WorkspaceRole;
  userId: string;
}

export interface PendingInvitation {
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  invitedByDisplayName: string | null;
  role: Exclude<WorkspaceRole, 'owner'>;
}

export interface TeamOverview {
  invitations: PendingInvitation[];
  members: TeamMember[];
}

export interface CreatedInvitation extends PendingInvitation {
  token: string;
}

export interface InvitationPreview {
  email: string;
  expiresAt: string;
  id: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export function listTeam(workspaceId: string): Promise<TeamOverview> {
  return apiRequest(`/workspaces/${workspaceId}/team`);
}

export function createInvitation(
  workspaceId: string,
  input: { email: string; role: Exclude<WorkspaceRole, 'owner'> },
): Promise<CreatedInvitation> {
  return apiRequest(`/workspaces/${workspaceId}/team/invitations`, {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function revokeInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<void> {
  return apiRequest(
    `/workspaces/${workspaceId}/team/invitations/${invitationId}`,
    { method: 'DELETE' },
  );
}

export function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: Exclude<WorkspaceRole, 'owner'>,
): Promise<TeamMember> {
  return apiRequest(`/workspaces/${workspaceId}/team/members/${userId}`, {
    body: JSON.stringify({ role }),
    method: 'PATCH',
  });
}

export function removeMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/team/members/${userId}`, {
    method: 'DELETE',
  });
}

export function previewInvitation(token: string): Promise<InvitationPreview> {
  return apiRequest(`/invitations/${encodeURIComponent(token)}`);
}

export function acceptInvitation(token: string): Promise<{ id: string }> {
  return apiRequest(`/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  });
}
import { apiRequest } from './api-client';
