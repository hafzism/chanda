export type KnowledgeVersionStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed';

export interface KnowledgeDocumentSummary {
  chunkCount: number;
  createdAt: Date;
  id: string;
  isEnabled: boolean;
  mimeType: string;
  sourceKind: 'file' | 'article';
  status: KnowledgeVersionStatus;
  title: string;
  updatedAt: Date;
  version: number;
  versionId: string;
}

export interface CreateArticleRecord {
  byteSize: number;
  contentHash: string;
  documentId: string;
  objectKey: string;
  title: string;
  userId: string;
  versionId: string;
  workspaceId: string;
}

export interface KnowledgeRetrievalMetadata {
  characterEnd: number;
  characterStart: number;
  content: string;
  documentId: string;
  heading: string | null;
  title: string;
  versionId: string;
}

export interface KnowledgeRetrievalHit {
  chunkId: string;
  metadata: KnowledgeRetrievalMetadata;
  providerScore: number;
}

export interface KnowledgeRepository {
  createQueuedArticle(
    input: CreateArticleRecord,
  ): Promise<KnowledgeDocumentSummary>;
  deleteDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<string[] | null>;
  keywordSearch(
    workspaceId: string,
    query: string,
  ): Promise<KnowledgeRetrievalHit[]>;
  list(workspaceId: string): Promise<KnowledgeDocumentSummary[]>;
  markVersionFailed(
    versionId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void>;
  scheduleVersionIndexing(input: {
    documentId: string;
    objectKey: string;
    versionId: string;
    workspaceId: string;
  }): Promise<void>;
  semanticSearch(
    workspaceId: string,
    embedding: number[],
  ): Promise<KnowledgeRetrievalHit[]>;
  setEnabled(
    workspaceId: string,
    documentId: string,
    isEnabled: boolean,
  ): Promise<boolean>;
}
