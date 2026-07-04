export type KnowledgeStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface KnowledgeDocument {
  chunkCount: number;
  createdAt: string;
  id: string;
  isEnabled: boolean;
  mimeType: string;
  sourceKind: 'article' | 'file';
  status: KnowledgeStatus;
  title: string;
  updatedAt: string;
  version: number;
  versionId: string;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  fusedScore: number;
  keywordRank: number | null;
  metadata: {
    characterEnd: number;
    characterStart: number;
    content: string;
    documentId: string;
    heading: string | null;
    title: string;
    versionId: string;
  };
  semanticRank: number | null;
}

export interface KnowledgeSearchResponse {
  mode: 'hybrid' | 'keyword';
  results: KnowledgeSearchResult[];
}

export interface KnowledgeChunkInspection {
  chunks: Array<{
    characterEnd: number;
    characterStart: number;
    content: string;
    heading: string | null;
    id: string;
    ordinal: number;
  }>;
  status: KnowledgeStatus;
}

async function knowledgeRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new Error(message ?? 'The knowledge request could not be completed.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function knowledgeFormRequest<T>(path: string, form: FormData) {
  const response = await fetch(`/api/v1${path}`, {
    body: form,
    method: 'POST',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new Error(message ?? 'The knowledge upload could not be completed.');
  }
  return response.json() as Promise<T>;
}

export function listKnowledge(workspaceId: string) {
  return knowledgeRequest<KnowledgeDocument[]>(
    `/workspaces/${workspaceId}/knowledge`,
  );
}

export function createKnowledgeArticle(
  workspaceId: string,
  input: { content: string; title: string },
) {
  return knowledgeRequest<KnowledgeDocument>(
    `/workspaces/${workspaceId}/knowledge/articles`,
    { body: JSON.stringify(input), method: 'POST' },
  );
}

export function uploadKnowledgeFile(workspaceId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return knowledgeFormRequest<KnowledgeDocument>(
    `/workspaces/${workspaceId}/knowledge/files`,
    form,
  );
}

export function searchKnowledge(workspaceId: string, query: string) {
  return knowledgeRequest<KnowledgeSearchResponse>(
    `/workspaces/${workspaceId}/knowledge/search`,
    { body: JSON.stringify({ maxResults: 6, query }), method: 'POST' },
  );
}

export function inspectKnowledgeChunks(
  workspaceId: string,
  documentId: string,
) {
  return knowledgeRequest<KnowledgeChunkInspection>(
    `/workspaces/${workspaceId}/knowledge/${documentId}/chunks`,
  );
}

export function reindexKnowledge(workspaceId: string, documentId: string) {
  return knowledgeRequest<void>(
    `/workspaces/${workspaceId}/knowledge/${documentId}/reindex`,
    { method: 'POST' },
  );
}

export function setKnowledgeEnabled(
  workspaceId: string,
  documentId: string,
  isEnabled: boolean,
) {
  return knowledgeRequest<void>(
    `/workspaces/${workspaceId}/knowledge/${documentId}/enabled`,
    { body: JSON.stringify({ isEnabled }), method: 'PATCH' },
  );
}

export function deleteKnowledge(workspaceId: string, documentId: string) {
  return knowledgeRequest<void>(
    `/workspaces/${workspaceId}/knowledge/${documentId}`,
    { method: 'DELETE' },
  );
}
