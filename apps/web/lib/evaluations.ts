export interface RetrievalEvaluationCase {
  createdAt: string;
  expectedDocumentId: string;
  expectedDocumentTitle: string;
  id: string;
  question: string;
}

export interface RetrievalEvaluationResult {
  caseId: string | null;
  expectedDocumentId: string | null;
  expectedDocumentTitle: string;
  id: string;
  question: string;
  reciprocalRank: number;
  retrievalMode: 'hybrid' | 'keyword';
  retrievedDocumentIds: string[];
  wasHit: boolean;
}

export interface RetrievalEvaluationRun {
  caseCount: number;
  createdAt: string;
  hitCount: number;
  hitRate: number;
  hybridCaseCount: number;
  id: string;
  keywordOnlyCaseCount: number;
  meanReciprocalRank: number;
  results: RetrievalEvaluationResult[];
  topK: number;
}

async function evaluationRequest<T>(path: string, init?: RequestInit) {
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
    throw new Error(
      message ?? 'The evaluation request could not be completed.',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const path = (workspaceId: string) =>
  `/workspaces/${workspaceId}/analytics/evaluations`;

export function listEvaluationCases(workspaceId: string) {
  return evaluationRequest<RetrievalEvaluationCase[]>(
    `${path(workspaceId)}/cases`,
  );
}

export function createEvaluationCase(
  workspaceId: string,
  input: { expectedDocumentId: string; question: string },
) {
  return evaluationRequest<RetrievalEvaluationCase>(
    `${path(workspaceId)}/cases`,
    { body: JSON.stringify(input), method: 'POST' },
  );
}

export function deleteEvaluationCase(workspaceId: string, caseId: string) {
  return evaluationRequest<void>(`${path(workspaceId)}/cases/${caseId}`, {
    method: 'DELETE',
  });
}

export function listEvaluationRuns(workspaceId: string) {
  return evaluationRequest<RetrievalEvaluationRun[]>(
    `${path(workspaceId)}/runs`,
  );
}

export function runRetrievalEvaluation(workspaceId: string) {
  return evaluationRequest<RetrievalEvaluationRun>(
    `${path(workspaceId)}/runs`,
    { method: 'POST' },
  );
}
