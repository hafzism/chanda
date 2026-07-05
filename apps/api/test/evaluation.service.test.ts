import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { EvaluationService } from '../src/analytics/evaluation.service';
import type { EvaluationRepository } from '../src/analytics/evaluation.types';
import type { KnowledgeService } from '../src/knowledge/knowledge.service';

const cases = [
  {
    createdAt: new Date('2026-07-14T08:00:00.000Z'),
    expectedDocumentId: 'document-1',
    expectedDocumentTitle: 'Returns policy',
    id: 'case-1',
    question: 'How long do I have to return an item?',
  },
  {
    createdAt: new Date('2026-07-14T08:01:00.000Z'),
    expectedDocumentId: 'document-2',
    expectedDocumentTitle: 'Shipping guide',
    id: 'case-2',
    question: 'When will express shipping arrive?',
  },
];

describe('EvaluationService', () => {
  let repository: EvaluationRepository;
  let search: ReturnType<typeof vi.fn>;
  let createCase: MockedFunction<EvaluationRepository['createCase']>;
  let listCases: MockedFunction<EvaluationRepository['listCases']>;
  let saveRun: MockedFunction<EvaluationRepository['saveRun']>;
  let service: EvaluationService;

  beforeEach(() => {
    createCase = vi.fn<EvaluationRepository['createCase']>();
    listCases = vi
      .fn<EvaluationRepository['listCases']>()
      .mockResolvedValue(cases);
    saveRun = vi
      .fn<EvaluationRepository['saveRun']>()
      .mockImplementation((input) =>
        Promise.resolve({
          caseCount: input.results.length,
          createdAt: new Date('2026-07-14T09:00:00.000Z'),
          hitCount: input.results.filter((result) => result.wasHit).length,
          hitRate: 0.5,
          hybridCaseCount: input.hybridCaseCount,
          id: 'run-1',
          keywordOnlyCaseCount: input.keywordOnlyCaseCount,
          meanReciprocalRank: 0.25,
          results: input.results.map((result, index) => ({
            ...result,
            id: `result-${index + 1}`,
          })),
          topK: input.topK,
        }),
      );
    repository = {
      createCase,
      deleteCase: vi.fn(),
      listCases,
      listRuns: vi.fn(),
      saveRun,
    };
    search = vi.fn();
    service = new EvaluationService(repository, {
      search,
    } as unknown as KnowledgeService);
  });

  it('records Hit@5, reciprocal rank, and retrieval-mode coverage', async () => {
    search
      .mockResolvedValueOnce({
        mode: 'hybrid',
        results: [
          { metadata: { documentId: 'distractor' } },
          { metadata: { documentId: 'document-1' } },
        ],
      })
      .mockResolvedValueOnce({
        mode: 'keyword',
        results: [{ metadata: { documentId: 'distractor' } }],
      });

    await service.run('workspace-1', 'user-1');

    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(1, 'workspace-1', {
      maxResults: 5,
      query: cases[0]?.question,
    });
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        hybridCaseCount: 1,
        keywordOnlyCaseCount: 1,
        requestedByUserId: 'user-1',
        topK: 5,
        workspaceId: 'workspace-1',
        results: [
          expect.objectContaining({ reciprocalRank: 0.5, wasHit: true }),
          expect.objectContaining({ reciprocalRank: 0, wasHit: false }),
        ],
      }),
    );
  });

  it('requires at least one curated case', async () => {
    listCases.mockResolvedValue([]);

    await expect(service.run('workspace-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(search).not.toHaveBeenCalled();
  });

  it('maps the suite limit to an actionable conflict', async () => {
    createCase.mockResolvedValue('limit');

    await expect(
      service.createCase('workspace-1', 'user-1', {
        expectedDocumentId: '00000000-0000-4000-8000-000000000001',
        question: '  What is the returns window?  ',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
