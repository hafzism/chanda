export interface RankedRetrievalHit<TMetadata = unknown> {
  chunkId: string;
  metadata: TMetadata;
  providerScore: number;
}

export interface FusedRetrievalHit<TMetadata = unknown> {
  chunkId: string;
  fusedScore: number;
  keywordRank: number | null;
  keywordScore: number | null;
  metadata: TMetadata;
  semanticRank: number | null;
  semanticScore: number | null;
}

export interface RetrievalFusionOptions {
  keywordWeight?: number;
  limit?: number;
  rankConstant?: number;
  semanticWeight?: number;
}

export function fuseRetrievalResults<TMetadata>(
  keywordHits: RankedRetrievalHit<TMetadata>[],
  semanticHits: RankedRetrievalHit<TMetadata>[],
  options: RetrievalFusionOptions = {},
): FusedRetrievalHit<TMetadata>[] {
  const rankConstant = options.rankConstant ?? 60;
  const keywordWeight = options.keywordWeight ?? 1;
  const semanticWeight = options.semanticWeight ?? 1;
  const limit = options.limit ?? 8;

  if (rankConstant <= 0 || limit <= 0) {
    throw new RangeError('rankConstant and limit must be positive.');
  }
  if (keywordWeight < 0 || semanticWeight < 0) {
    throw new RangeError('retrieval weights cannot be negative.');
  }

  const fused = new Map<string, FusedRetrievalHit<TMetadata>>();

  keywordHits.forEach((hit, index) => {
    const rank = index + 1;
    fused.set(hit.chunkId, {
      chunkId: hit.chunkId,
      fusedScore: keywordWeight / (rankConstant + rank),
      keywordRank: rank,
      keywordScore: hit.providerScore,
      metadata: hit.metadata,
      semanticRank: null,
      semanticScore: null,
    });
  });

  semanticHits.forEach((hit, index) => {
    const rank = index + 1;
    const existing = fused.get(hit.chunkId);
    const contribution = semanticWeight / (rankConstant + rank);

    if (existing) {
      existing.fusedScore += contribution;
      existing.semanticRank = rank;
      existing.semanticScore = hit.providerScore;
      return;
    }

    fused.set(hit.chunkId, {
      chunkId: hit.chunkId,
      fusedScore: contribution,
      keywordRank: null,
      keywordScore: null,
      metadata: hit.metadata,
      semanticRank: rank,
      semanticScore: hit.providerScore,
    });
  });

  return [...fused.values()]
    .sort(
      (left, right) =>
        right.fusedScore - left.fusedScore ||
        left.chunkId.localeCompare(right.chunkId),
    )
    .slice(0, limit);
}
