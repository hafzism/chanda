import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  inspectKnowledgeChunks,
  reindexKnowledge,
  searchKnowledge,
  uploadKnowledgeFile,
} from '../lib/knowledge';

describe('knowledge operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads a source as multipart data without forcing a JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'document-1',
          sourceKind: 'file',
          status: 'queued',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['Approved returns policy content'], 'returns.txt', {
      type: 'text/plain',
    });

    await uploadKnowledgeFile('workspace-1', file);

    const request = fetchMock.mock.calls[0];
    const init = request?.[1] as RequestInit | undefined;
    expect(request?.[0]).toBe('/api/v1/workspaces/workspace-1/knowledge/files');
    expect(init).toMatchObject({ method: 'POST' });
    expect(init?.headers).toBeUndefined();
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('file')).toBe(file);
  });

  it('submits a bounded retrieval evaluation query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mode: 'hybrid', results: [] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await searchKnowledge('workspace-1', 'Can I return an opened item?');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/knowledge/search',
      expect.objectContaining({
        body: JSON.stringify({
          maxResults: 6,
          query: 'Can I return an opened item?',
        }),
        method: 'POST',
      }),
    );
  });

  it('uses separate inspection and re-index operations', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return Promise.resolve(
        new Response(
          url.endsWith('/chunks')
            ? JSON.stringify({ chunks: [], status: 'ready' })
            : null,
          { status: url.endsWith('/chunks') ? 200 : 204 },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await inspectKnowledgeChunks('workspace-1', 'document-1');
    await reindexKnowledge('workspace-1', 'document-1');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/workspaces/workspace-1/knowledge/document-1/chunks',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/v1/workspaces/workspace-1/knowledge/document-1/reindex',
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });
});
