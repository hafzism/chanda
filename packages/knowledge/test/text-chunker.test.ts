import { describe, expect, it } from 'vitest';

import {
  chunkKnowledgeText,
  estimateTokenCount,
  normalizeKnowledgeText,
} from '../src/text-chunker';

describe('knowledge text normalization', () => {
  it('normalizes line endings and removes unsafe control characters', () => {
    expect(
      normalizeKnowledgeText('  Policy\r\nline\u0000  \r\n\r\n\r\n\r\nEnd  '),
    ).toBe('Policy\nline\n\n\nEnd');
  });
});

describe('knowledge chunking', () => {
  it('preserves Markdown headings and stable citation offsets', () => {
    const input =
      '# Returns\n\nItems can be returned within 30 days.\n\n## Exceptions\n\nFinal-sale items cannot be returned.';
    const normalized = normalizeKnowledgeText(input);
    const chunks = chunkKnowledgeText(input);

    expect(chunks).toHaveLength(2);
    expect(chunks.map((chunk) => chunk.heading)).toEqual([
      'Returns',
      'Exceptions',
    ]);
    for (const chunk of chunks) {
      expect(normalized.slice(chunk.characterStart, chunk.characterEnd)).toBe(
        chunk.content,
      );
      expect(chunk.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('creates bounded overlapping chunks at natural boundaries', () => {
    const input = Array.from(
      { length: 40 },
      (_, index) =>
        `Sentence ${index + 1} explains an important support policy.`,
    ).join(' ');
    const chunks = chunkKnowledgeText(input, {
      maxCharacters: 320,
      overlapCharacters: 60,
    });

    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((chunk) => chunk.content.length <= 320)).toBe(true);
    expect(chunks[1]?.characterStart).toBeLessThan(
      chunks[0]?.characterEnd ?? 0,
    );
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(
      chunks.map((_, index) => index),
    );
  });

  it('returns deterministic hashes and heuristic token estimates', () => {
    const first = chunkKnowledgeText(
      'Shipping normally takes three business days.',
    );
    const second = chunkKnowledgeText(
      'Shipping normally takes three business days.',
    );

    expect(first).toEqual(second);
    expect(estimateTokenCount('Shipping takes 3 days.')).toBeGreaterThan(3);
  });

  it('rejects invalid chunk settings and empty content', () => {
    expect(chunkKnowledgeText('   ')).toEqual([]);
    expect(() =>
      chunkKnowledgeText('content', {
        maxCharacters: 300,
        overlapCharacters: 150,
      }),
    ).toThrow(RangeError);
  });
});
