export interface HealthResponse {
  service: 'api';
  status: 'ok';
}

export interface ReadinessResponse extends HealthResponse {
  checks: {
    database: 'ok';
    redis: 'ok';
  };
}

export const KNOWLEDGE_INDEX_QUEUE = 'knowledge-index';
export const KNOWLEDGE_VERSION_INDEX_REQUESTED =
  'knowledge.version.index.requested';

export interface KnowledgeIndexJob {
  documentId: string;
  objectKey: string;
  versionId: string;
  workspaceId: string;
}

export function isKnowledgeIndexJob(
  value: unknown,
): value is KnowledgeIndexJob {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return ['documentId', 'objectKey', 'versionId', 'workspaceId'].every(
    (key) => typeof candidate[key] === 'string' && candidate[key].length > 0,
  );
}
