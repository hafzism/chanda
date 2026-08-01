import { describe, expect, it } from 'vitest';

import {
  AI_PROVIDER_MODEL_CONFIGURATIONS,
  isAiProvider,
} from '../src/provider-config';

describe('AI provider model configuration', () => {
  it('keeps every supported embedding index at 1536 dimensions', () => {
    expect(
      Object.values(AI_PROVIDER_MODEL_CONFIGURATIONS).every(
        ({ embeddingDimensions }) => embeddingDimensions === 1536,
      ),
    ).toBe(true);
  });

  it('accepts only supported providers', () => {
    expect(isAiProvider('openai')).toBe(true);
    expect(isAiProvider('google-gemini')).toBe(true);
    expect(isAiProvider('arbitrary-provider')).toBe(false);
  });
});
