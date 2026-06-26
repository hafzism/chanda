export {
  chunkKnowledgeText,
  estimateTokenCount,
  normalizeKnowledgeText,
} from './text-chunker';
export type { KnowledgeChunk, TextChunkOptions } from './text-chunker';
export {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_PROVIDER,
} from './embedding-config';
export { fuseRetrievalResults } from './retrieval-fusion';
export type {
  FusedRetrievalHit,
  RankedRetrievalHit,
  RetrievalFusionOptions,
} from './retrieval-fusion';
