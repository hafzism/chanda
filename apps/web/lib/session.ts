import type { User } from 'firebase/auth';

import { apiRequest, ApiRequestError } from './api-client';

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

export async function createSession(
  firebaseUser: User,
): Promise<SessionResponse> {
  const idToken = await firebaseUser.getIdToken(true);
  return apiRequest<SessionResponse>('/auth/session', {
    body: JSON.stringify({ idToken }),
    method: 'POST',
  });
}

export async function readSession(): Promise<SessionResponse | null> {
  try {
    return await apiRequest<SessionResponse>('/auth/session');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
}

export async function revokeSession(): Promise<void> {
  try {
    await apiRequest<void>('/auth/session', { method: 'DELETE' });
  } catch (error) {
    if (!(error instanceof ApiRequestError && error.status === 401)) {
      throw error;
    }
  }
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return apiRequest<WorkspaceSummary[]>('/workspaces');
}

export async function createWorkspace(input: {
  name: string;
  slug: string;
}): Promise<WorkspaceSummary> {
  return apiRequest<WorkspaceSummary>('/workspaces', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}
