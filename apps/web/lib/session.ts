import type { User } from 'firebase/auth';

export interface SessionUser {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  id: string;
}

export interface SessionResponse {
  expiresAt: string;
  user: SessionUser;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
  slug: string;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return Array.isArray(body.message)
      ? body.message.join(' ')
      : (body.message ?? 'Unable to complete the request.');
  } catch {
    return 'Unable to complete the request.';
  }
}

export async function createSupplineSession(
  firebaseUser: User,
): Promise<SessionResponse> {
  const idToken = await firebaseUser.getIdToken(true);
  const response = await fetch('/api/v1/auth/session', {
    body: JSON.stringify({ idToken }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as SessionResponse;
}

export async function readSupplineSession(): Promise<SessionResponse | null> {
  const response = await fetch('/api/v1/auth/session', { cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as SessionResponse;
}

export async function revokeSupplineSession(): Promise<void> {
  const response = await fetch('/api/v1/auth/session', { method: 'DELETE' });
  if (!response.ok && response.status !== 401) {
    throw new Error(await errorMessage(response));
  }
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const response = await fetch('/api/v1/workspaces', { cache: 'no-store' });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as WorkspaceSummary[];
}

export async function createWorkspace(input: {
  name: string;
  slug: string;
}): Promise<WorkspaceSummary> {
  const response = await fetch('/api/v1/workspaces', {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as WorkspaceSummary;
}
