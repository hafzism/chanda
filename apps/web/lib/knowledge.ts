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

export function listKnowledge(workspaceId: string) {
  return apiRequest<KnowledgeDocument[]>(
    `/workspaces/${workspaceId}/knowledge`,
  );
}

export function createKnowledgeArticle(
  workspaceId: string,
  input: { content: string; title: string },
) {
  return apiRequest<KnowledgeDocument>(
    `/workspaces/${workspaceId}/knowledge/articles`,
    { body: JSON.stringify(input), method: 'POST' },
  );
}

export function uploadKnowledgeFile(workspaceId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<KnowledgeDocument>(
    `/workspaces/${workspaceId}/knowledge/files`,
    { body: form, method: 'POST' },
  );
}

export function searchKnowledge(workspaceId: string, query: string) {
  return apiRequest<KnowledgeSearchResponse>(
    `/workspaces/${workspaceId}/knowledge/search`,
    { body: JSON.stringify({ maxResults: 6, query }), method: 'POST' },
  );
}

export function inspectKnowledgeChunks(
  workspaceId: string,
  documentId: string,
) {
  return apiRequest<KnowledgeChunkInspection>(
    `/workspaces/${workspaceId}/knowledge/${documentId}/chunks`,
  );
}

export function reindexKnowledge(workspaceId: string, documentId: string) {
  return apiRequest<void>(
    `/workspaces/${workspaceId}/knowledge/${documentId}/reindex`,
    { method: 'POST' },
  );
}

export function setKnowledgeEnabled(
  workspaceId: string,
  documentId: string,
  isEnabled: boolean,
) {
  return apiRequest<void>(
    `/workspaces/${workspaceId}/knowledge/${documentId}/enabled`,
    { body: JSON.stringify({ isEnabled }), method: 'PATCH' },
  );
}

export function deleteKnowledge(workspaceId: string, documentId: string) {
  return apiRequest<void>(
    `/workspaces/${workspaceId}/knowledge/${documentId}`,
    { method: 'DELETE' },
  );
}
import { apiRequest } from './api-client';
