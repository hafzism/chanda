import { describe, expect, it } from 'vitest';

import { parseAiDraftResponse } from '../src/support/ai-draft-generator';

describe('AI draft response parsing', () => {
  it('accepts raw structured JSON', () => {
    expect(parseAiDraftResponse('{"body":"Hello"}')).toEqual({
      body: 'Hello',
    });
  });

  it('accepts a single complete JSON fence from provider fallbacks', () => {
    expect(
      parseAiDraftResponse('```json\n{"body":"Grounded reply"}\n```'),
    ).toEqual({ body: 'Grounded reply' });
  });

  it('rejects prose surrounding a structured response', () => {
    expect(() =>
      parseAiDraftResponse('Here is the reply: {"body":"Hello"}'),
    ).toThrow(SyntaxError);
  });
});
