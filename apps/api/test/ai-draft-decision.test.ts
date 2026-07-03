import { describe, expect, it } from 'vitest';

import { decideAiDraft } from '../src/support/ai-draft-decision';
import type { AiDraftCitation } from '../src/support/support.types';

const citation: AiDraftCitation = {
  characterEnd: 40,
  characterStart: 0,
  content: 'Orders normally arrive within three business days.',
  documentId: 'document-1',
  heading: 'Delivery',
  keywordRank: 1,
  semanticRank: 1,
  title: 'Shipping policy',
  versionId: 'version-1',
};

describe('decideAiDraft', () => {
  it('escalates when no approved evidence exists', () => {
    expect(
      decideAiDraft({
        citations: [],
        query: 'Where is my order?',
        retrievalMode: 'hybrid',
      }),
    ).toMatchObject({ readinessScore: 0, requiresHuman: true });
  });

  it('caps sensitive cases even with evidence from both retrieval modes', () => {
    expect(
      decideAiDraft({
        citations: [citation, { ...citation, documentId: 'document-2' }],
        query: 'My payment was taken but the order failed.',
        retrievalMode: 'hybrid',
      }),
    ).toMatchObject({ readinessScore: 49, requiresHuman: true });
  });

  it('marks strong hybrid evidence as eligible but still leaves sending to the human workflow', () => {
    expect(
      decideAiDraft({
        citations: [
          citation,
          { ...citation, documentId: 'document-2' },
          { ...citation, documentId: 'document-3' },
        ],
        query: 'How long does delivery take?',
        retrievalMode: 'hybrid',
      }),
    ).toMatchObject({
      escalationReason: null,
      readinessScore: 88,
      requiresHuman: false,
    });
  });
});
