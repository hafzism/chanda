import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createEvaluationCase,
  listEvaluationRuns,
  runRetrievalEvaluation,
} from '../lib/evaluations';

describe('retrieval evaluation operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates a tenant-scoped expected-source case', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          expectedDocumentId: 'document-1',
          id: 'case-1',
          question: 'What is the returns window?',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createEvaluationCase('workspace-1', {
      expectedDocumentId: 'document-1',
      question: 'What is the returns window?',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/analytics/evaluations/cases',
      expect.objectContaining({
        body: JSON.stringify({
          expectedDocumentId: 'document-1',
          question: 'What is the returns window?',
        }),
        method: 'POST',
      }),
    );
  });

  it('uses distinct read and run operations', async () => {
    const fetchMock = vi.fn().mockImplementation((_path, init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify(init?.method === 'POST' ? {} : []), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listEvaluationRuns('workspace-1');
    await runRetrievalEvaluation('workspace-1');

    const url = '/api/v1/workspaces/workspace-1/analytics/evaluations/runs';
    expect(fetchMock.mock.calls[0]?.[0]).toBe(url);
    expect(fetchMock.mock.calls[1]).toEqual([
      url,
      expect.objectContaining({ method: 'POST' }),
    ]);
  });
});
