export const PRODUCT_NAME = 'Chanda AI';
export const PRODUCT_SHORT_NAME = 'Chanda';

export const LAST_WORKSPACE_STORAGE_KEY = 'chanda:last-workspace-id';
export const LEGACY_LAST_WORKSPACE_STORAGE_KEY = 'suppline:last-workspace-id';

export function readLastWorkspaceId(): string | null {
  const current = window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY);
  if (current) return current;

  const legacy = window.localStorage.getItem(LEGACY_LAST_WORKSPACE_STORAGE_KEY);
  if (legacy) {
    window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, legacy);
    window.localStorage.removeItem(LEGACY_LAST_WORKSPACE_STORAGE_KEY);
  }
  return legacy;
}

export function saveLastWorkspaceId(workspaceId: string): void {
  window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, workspaceId);
  window.localStorage.removeItem(LEGACY_LAST_WORKSPACE_STORAGE_KEY);
}
