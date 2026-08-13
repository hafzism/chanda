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

const path = (workspaceId: string) =>
  `/workspaces/${workspaceId}/analytics/evaluations`;

export function listEvaluationCases(workspaceId: string) {
  return apiRequest<RetrievalEvaluationCase[]>(`${path(workspaceId)}/cases`);
}

export function createEvaluationCase(
  workspaceId: string,
  input: { expectedDocumentId: string; question: string },
) {
  return apiRequest<RetrievalEvaluationCase>(`${path(workspaceId)}/cases`, {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function deleteEvaluationCase(workspaceId: string, caseId: string) {
  return apiRequest<void>(`${path(workspaceId)}/cases/${caseId}`, {
    method: 'DELETE',
  });
}

export function listEvaluationRuns(workspaceId: string) {
  return apiRequest<RetrievalEvaluationRun[]>(`${path(workspaceId)}/runs`);
}

export function runRetrievalEvaluation(workspaceId: string) {
  return apiRequest<RetrievalEvaluationRun>(`${path(workspaceId)}/runs`, {
    method: 'POST',
  });
}
import { apiRequest } from './api-client';
