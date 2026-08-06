import type { KnowledgeIndexJob } from '@suppline/contracts';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmbeddingProvider } from '../src/embedding.service';
import { KnowledgeIndexProcessor } from '../src/knowledge-index.processor';
import type { KnowledgeIndexRepository } from '../src/knowledge-index.repository';
import type { SourceStorageService } from '../src/source-storage.service';

const data: KnowledgeIndexJob = {
  documentId: 'document-1',
  objectKey: 'workspaces/workspace-1/knowledge/source.md',
  versionId: 'version-1',
  workspaceId: 'workspace-1',
};

const job = { data } as Job<KnowledgeIndexJob>;

describe('KnowledgeIndexProcessor', () => {
  const claim = vi.fn<KnowledgeIndexRepository['claim']>();
  const complete = vi.fn<KnowledgeIndexRepository['complete']>();
  const embedDocuments = vi.fn<EmbeddingProvider['embedDocuments']>();
  const readText = vi.fn<SourceStorageService['readText']>();
  let processor: KnowledgeIndexProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    claim.mockResolvedValue(true);
    complete.mockResolvedValue(undefined);
    embedDocuments.mockResolvedValue({
      dimensions: 1536,
      embeddingRevision: 1,
      model: 'gemini-embedding-2',
      provider: 'google-gemini',
      vectors: [Array.from({ length: 1536 }, () => 0.1)],
    });
    readText.mockResolvedValue(
      '# Returns\n\nCustomers may return unused products within 30 days.',
    );
    processor = new KnowledgeIndexProcessor(
      { claim, complete, fail: vi.fn() } as unknown as KnowledgeIndexRepository,
      { readText } as unknown as SourceStorageService,
      { embedDocuments },
    );
  });

  it('chunks, embeds, and atomically completes a claimed version', async () => {
    await processor.process(job);

    expect(claim).toHaveBeenCalledWith(data);
    expect(readText).toHaveBeenCalledWith(data.objectKey);
    expect(embedDocuments).toHaveBeenCalledWith('workspace-1', [
      'Returns\n\nCustomers may return unused products within 30 days.',
    ]);
    const completed = complete.mock.calls[0];
    expect(completed?.[0]).toBe(data);
    expect(completed?.[1]).toHaveLength(1);
    expect(completed?.[2]?.vectors[0]).toHaveLength(1536);
  });

  it('does not repeat work for an already-ready version', async () => {
    claim.mockResolvedValue(false);

    await processor.process(job);

    expect(readText).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('leaves completion untouched when embedding fails for BullMQ retry', async () => {
    embedDocuments.mockRejectedValue(new Error('provider unavailable'));

    await expect(processor.process(job)).rejects.toThrow(
      'provider unavailable',
    );
    expect(complete).not.toHaveBeenCalled();
  });
});
