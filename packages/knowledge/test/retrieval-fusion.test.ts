import { describe, expect, it } from 'vitest';

import { fuseRetrievalResults } from '../src/retrieval-fusion';

const metadata = (title: string) => ({ title });

describe('reciprocal rank fusion', () => {
  it('rewards evidence found by both keyword and semantic retrieval', () => {
    const results = fuseRetrievalResults(
      [
        {
          chunkId: 'exact-only',
          metadata: metadata('Exact'),
          providerScore: 0.9,
        },
        { chunkId: 'both', metadata: metadata('Both'), providerScore: 0.7 },
      ],
      [
        {
          chunkId: 'semantic-only',
          metadata: metadata('Semantic'),
          providerScore: 0.95,
        },
        { chunkId: 'both', metadata: metadata('Both'), providerScore: 0.8 },
      ],
    );

    expect(results[0]).toMatchObject({
      chunkId: 'both',
      keywordRank: 2,
      semanticRank: 2,
    });
  });

  it('preserves channel scores for evaluation and deterministic tie-breaking', () => {
    const results = fuseRetrievalResults(
      [{ chunkId: 'b', metadata: metadata('B'), providerScore: 0.77 }],
      [{ chunkId: 'a', metadata: metadata('A'), providerScore: 0.81 }],
      { limit: 2 },
    );

    expect(results.map((result) => result.chunkId)).toEqual(['a', 'b']);
    expect(results[0]).toMatchObject({
      keywordScore: null,
      semanticScore: 0.81,
    });
  });

  it('supports weighted channels and result limits', () => {
    const results = fuseRetrievalResults(
      [
        { chunkId: 'keyword', metadata: metadata('Keyword'), providerScore: 1 },
        { chunkId: 'second', metadata: metadata('Second'), providerScore: 0.5 },
      ],
      [
        {
          chunkId: 'semantic',
          metadata: metadata('Semantic'),
          providerScore: 1,
        },
      ],
      { keywordWeight: 2, limit: 1 },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.chunkId).toBe('keyword');
  });

  it('rejects invalid ranking configuration', () => {
    expect(() => fuseRetrievalResults([], [], { rankConstant: 0 })).toThrow(
      RangeError,
    );
    expect(() => fuseRetrievalResults([], [], { semanticWeight: -1 })).toThrow(
      RangeError,
    );
  });
});
