import type { AiDraftCitation } from './support.types';

export interface DraftDecision {
  escalationReason: string | null;
  readinessScore: number;
  requiresHuman: boolean;
}

const sensitivePattern =
  /\b(payment|paid|refund|chargeback|bank|card|legal|lawsuit|password|account|personal data|privacy)\b/i;
const angerPattern =
  /\b(angry|furious|unacceptable|scam|fraud|terrible|worst)\b/i;

export function decideAiDraft(input: {
  citations: AiDraftCitation[];
  query: string;
  retrievalMode: 'hybrid' | 'keyword';
}): DraftDecision {
  if (input.citations.length === 0) {
    return {
      escalationReason: 'No approved knowledge evidence matched this request.',
      readinessScore: 0,
      requiresHuman: true,
    };
  }

  const top = input.citations[0];
  const appearsInBoth = Boolean(top?.keywordRank && top.semanticRank);
  const score = Math.min(
    100,
    40 +
      Math.min(20, input.citations.length * 4) +
      (input.retrievalMode === 'hybrid' ? 16 : 0) +
      (appearsInBoth ? 20 : 0),
  );

  if (sensitivePattern.test(input.query)) {
    return {
      escalationReason:
        'Sensitive payment, legal, privacy, or account-specific language requires human review.',
      readinessScore: Math.min(score, 49),
      requiresHuman: true,
    };
  }
  if (angerPattern.test(input.query)) {
    return {
      escalationReason:
        'Customer-frustration language requires empathetic human review.',
      readinessScore: Math.min(score, 59),
      requiresHuman: true,
    };
  }
  if (input.retrievalMode === 'keyword') {
    return {
      escalationReason:
        'Semantic retrieval was unavailable, so only keyword evidence was checked.',
      readinessScore: Math.min(score, 59),
      requiresHuman: true,
    };
  }
  if (score < 75) {
    return {
      escalationReason:
        'The retrieved evidence was not strong enough for automation.',
      readinessScore: score,
      requiresHuman: true,
    };
  }
  return {
    escalationReason: null,
    readinessScore: score,
    requiresHuman: false,
  };
}
