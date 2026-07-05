export interface RetrievalEvaluationCase {
  createdAt: Date;
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
  createdAt: Date;
  hitCount: number;
  hitRate: number;
  hybridCaseCount: number;
  id: string;
  keywordOnlyCaseCount: number;
  meanReciprocalRank: number;
  results: RetrievalEvaluationResult[];
  topK: number;
}

export interface SaveEvaluationRun {
  hybridCaseCount: number;
  keywordOnlyCaseCount: number;
  requestedByUserId: string;
  results: Array<{
    caseId: string;
    expectedDocumentId: string;
    expectedDocumentTitle: string;
    question: string;
    reciprocalRank: number;
    retrievalMode: 'hybrid' | 'keyword';
    retrievedDocumentIds: string[];
    wasHit: boolean;
  }>;
  topK: number;
  workspaceId: string;
}

export interface EvaluationRepository {
  createCase(input: {
    expectedDocumentId: string;
    question: string;
    userId: string;
    workspaceId: string;
  }): Promise<RetrievalEvaluationCase | 'document_unavailable' | 'limit'>;
  deleteCase(workspaceId: string, caseId: string): Promise<boolean>;
  listCases(workspaceId: string): Promise<RetrievalEvaluationCase[]>;
  listRuns(workspaceId: string): Promise<RetrievalEvaluationRun[]>;
  saveRun(input: SaveEvaluationRun): Promise<RetrievalEvaluationRun>;
}
