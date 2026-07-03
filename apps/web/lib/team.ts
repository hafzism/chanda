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

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return Array.isArray(body.message)
      ? body.message.join(' ')
      : (body.message ?? 'Unable to complete the request.');
  } catch {
    return 'Unable to complete the request.';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('content-type', 'application/json');
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers,
  });
  if (!response.ok) throw new Error(await responseError(response));
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function listTeam(workspaceId: string): Promise<TeamOverview> {
  return request(`/api/v1/workspaces/${workspaceId}/team`);
}

export function createInvitation(
  workspaceId: string,
  input: { email: string; role: Exclude<WorkspaceRole, 'owner'> },
): Promise<CreatedInvitation> {
  return request(`/api/v1/workspaces/${workspaceId}/team/invitations`, {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function revokeInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<void> {
  return request(
    `/api/v1/workspaces/${workspaceId}/team/invitations/${invitationId}`,
    { method: 'DELETE' },
  );
}

export function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: Exclude<WorkspaceRole, 'owner'>,
): Promise<TeamMember> {
  return request(`/api/v1/workspaces/${workspaceId}/team/members/${userId}`, {
    body: JSON.stringify({ role }),
    method: 'PATCH',
  });
}

export function removeMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  return request(`/api/v1/workspaces/${workspaceId}/team/members/${userId}`, {
    method: 'DELETE',
  });
}

export function previewInvitation(token: string): Promise<InvitationPreview> {
  return request(`/api/v1/invitations/${encodeURIComponent(token)}`);
}

export function acceptInvitation(token: string): Promise<{ id: string }> {
  return request(`/api/v1/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  });
}
