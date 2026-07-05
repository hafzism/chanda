import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeKnowledgeText } from '@suppline/knowledge';

import { KnowledgeService } from '../knowledge/knowledge.service';
import type { CreateEvaluationCaseDto } from './dto/create-evaluation-case.dto';
import type { EvaluationRepository } from './evaluation.types';

export const EVALUATION_REPOSITORY = Symbol('EVALUATION_REPOSITORY');
const TOP_K = 5;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

@Injectable()
export class EvaluationService {
  constructor(
    @Inject(EVALUATION_REPOSITORY)
    private readonly repository: EvaluationRepository,
    private readonly knowledge: KnowledgeService,
  ) {}

  listCases(workspaceId: string) {
    return this.repository.listCases(workspaceId);
  }

  listRuns(workspaceId: string) {
    return this.repository.listRuns(workspaceId);
  }

  async createCase(
    workspaceId: string,
    userId: string,
    input: CreateEvaluationCaseDto,
  ) {
    const question = normalizeKnowledgeText(input.question);
    if (question.length < 2) {
      throw new BadRequestException(
        'Evaluation question must contain at least 2 characters.',
      );
    }

    try {
      const created = await this.repository.createCase({
        expectedDocumentId: input.expectedDocumentId,
        question,
        userId,
        workspaceId,
      });
      if (created === 'document_unavailable') {
        throw new BadRequestException(
          'Choose an enabled knowledge source that has finished indexing.',
        );
      }
      if (created === 'limit') {
        throw new ConflictException(
          'An evaluation suite can contain up to 20 cases.',
        );
      }
      return created;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This question already exists in the evaluation suite.',
        );
      }
      throw error;
    }
  }

  async deleteCase(workspaceId: string, caseId: string) {
    if (!(await this.repository.deleteCase(workspaceId, caseId))) {
      throw new NotFoundException('Evaluation case not found.');
    }
  }

  async run(workspaceId: string, userId: string) {
    const cases = await this.repository.listCases(workspaceId);
    if (cases.length === 0) {
      throw new BadRequestException(
        'Add at least one evaluation case before running the suite.',
      );
    }

    const results = [];
    let hybridCaseCount = 0;
    let keywordOnlyCaseCount = 0;

    // Deliberately sequential: evaluation traffic should not burst the
    // embedding provider or compete with live support requests.
    for (const evaluationCase of cases) {
      const retrieval = await this.knowledge.search(workspaceId, {
        maxResults: TOP_K,
        query: evaluationCase.question,
      });
      if (retrieval.mode === 'hybrid') hybridCaseCount += 1;
      else keywordOnlyCaseCount += 1;

      const retrievedDocumentIds = retrieval.results.map(
        ({ metadata }) => metadata.documentId,
      );
      const rank =
        retrievedDocumentIds.findIndex(
          (documentId) => documentId === evaluationCase.expectedDocumentId,
        ) + 1;
      results.push({
        caseId: evaluationCase.id,
        expectedDocumentId: evaluationCase.expectedDocumentId,
        expectedDocumentTitle: evaluationCase.expectedDocumentTitle,
        question: evaluationCase.question,
        reciprocalRank: rank === 0 ? 0 : 1 / rank,
        retrievalMode: retrieval.mode,
        retrievedDocumentIds,
        wasHit: rank > 0,
      });
    }

    return this.repository.saveRun({
      hybridCaseCount,
      keywordOnlyCaseCount,
      requestedByUserId: userId,
      results,
      topK: TOP_K,
      workspaceId,
    });
  }
}
