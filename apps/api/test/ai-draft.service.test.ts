import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KnowledgeService } from '../src/knowledge/knowledge.service';
import type { AiDraftGenerator } from '../src/support/ai-draft-generator';
import { AiDraftService } from '../src/support/ai-draft.service';
import type {
  AiDraft,
  AiDraftContext,
  SupportRepository,
} from '../src/support/support.types';

const context: AiDraftContext = {
  conversationId: 'conversation-1',
  inputMessageBody: 'How long does delivery take?',
  inputMessageId: 'message-1',
  ticketId: 'ticket-1',
  transcript: [
    { authorKind: 'customer', body: 'How long does delivery take?' },
  ],
};

const storedDraft: AiDraft = {
  body: 'Standard delivery takes three to five business days.',
  citations: [],
  createdAt: new Date('2026-07-13T00:00:00.000Z'),
  escalationReason: null,
  id: 'draft-1',
  model: 'gemini-3.5-flash',
  promptVersion: 'support-draft-v1',
  provider: 'gemini',
  readinessScore: 80,
  requiresHuman: false,
  retrievalMode: 'hybrid',
};

describe('AiDraftService', () => {
  const getContext = vi.fn<SupportRepository['getAiDraftContext']>();
  const saveDraft = vi.fn<SupportRepository['saveAiDraft']>();
  const generate = vi.fn<AiDraftGenerator['generate']>();
  const search = vi.fn<KnowledgeService['search']>();
  let service: AiDraftService;

  beforeEach(() => {
    vi.clearAllMocks();
    getContext.mockResolvedValue(context);
    saveDraft.mockImplementation((input) =>
      Promise.resolve({
        ...storedDraft,
        ...input,
        createdAt: storedDraft.createdAt,
        id: storedDraft.id,
      }),
    );
    service = new AiDraftService(
      {
        getAiDraftContext: getContext,
        saveAiDraft: saveDraft,
      } as unknown as SupportRepository,
      { generate },
      { search } as unknown as KnowledgeService,
    );
  });

  it('stores a deterministic handoff and never calls Gemini without evidence', async () => {
    search.mockResolvedValue({ mode: 'keyword', results: [] });

    await service.generate('workspace-1', 'conversation-1', 'user-1');

    expect(generate).not.toHaveBeenCalled();
    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        citations: [],
        escalationReason:
          'No approved knowledge evidence matched this request.',
        model: 'deterministic-handoff',
        promptVersion: 'safe-handoff-v1',
        provider: 'system',
        readinessScore: 0,
        requiresHuman: true,
      }),
    );
  });

  it('gives Gemini only retrieved evidence and stores its audit metadata', async () => {
    const evidence = {
      characterEnd: 48,
      characterStart: 0,
      content: 'Standard delivery takes three to five business days.',
      documentId: 'document-1',
      heading: 'Delivery times',
      title: 'Shipping policy',
      versionId: 'version-1',
    };
    search.mockResolvedValue({
      mode: 'hybrid',
      results: [
        {
          chunkId: 'chunk-1',
          fusedScore: 0.03,
          keywordRank: 1,
          keywordScore: 0.9,
          metadata: evidence,
          semanticRank: 1,
          semanticScore: 0.85,
        },
      ],
    });
    generate.mockResolvedValue({
      body: 'Standard delivery takes three to five business days.',
      model: 'gemini-3.5-flash',
      provider: 'google-gemini',
    });

    await service.generate('workspace-1', 'conversation-1', 'user-1');

    expect(generate).toHaveBeenCalledWith({
      context,
      evidence: [expect.objectContaining(evidence)],
      workspaceId: 'workspace-1',
    });
    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
        promptVersion: 'support-draft-v2',
        provider: 'google-gemini',
        readinessScore: 80,
        requiresHuman: false,
      }),
    );
  });

  it('fails closed when the conversation is outside the workspace', async () => {
    getContext.mockResolvedValue(null);

    await expect(
      service.generate('workspace-1', 'conversation-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(search).not.toHaveBeenCalled();
  });

  it('returns a temporary failure instead of storing a fabricated draft', async () => {
    search.mockResolvedValue({
      mode: 'keyword',
      results: [
        {
          chunkId: 'chunk-1',
          fusedScore: 0.02,
          keywordRank: 1,
          keywordScore: 0.8,
          metadata: {
            characterEnd: 24,
            characterStart: 0,
            content: 'Delivery takes three days.',
            documentId: 'document-1',
            heading: null,
            title: 'Shipping',
            versionId: 'version-1',
          },
          semanticRank: null,
          semanticScore: null,
        },
      ],
    });
    generate.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      service.generate('workspace-1', 'conversation-1', 'user-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(saveDraft).not.toHaveBeenCalled();
  });
});
