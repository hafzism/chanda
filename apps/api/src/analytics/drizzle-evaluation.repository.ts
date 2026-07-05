import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  knowledgeDocuments,
  retrievalEvaluationCases,
  retrievalEvaluationResults,
  retrievalEvaluationRuns,
  sql,
} from '@suppline/database';

import { DatabaseService } from '../database/database.service';
import type {
  EvaluationRepository,
  RetrievalEvaluationCase,
  RetrievalEvaluationRun,
  SaveEvaluationRun,
} from './evaluation.types';

@Injectable()
export class DrizzleEvaluationRepository implements EvaluationRepository {
  constructor(private readonly database: DatabaseService) {}

  async createCase(input: {
    expectedDocumentId: string;
    question: string;
    userId: string;
    workspaceId: string;
  }): Promise<RetrievalEvaluationCase | 'document_unavailable' | 'limit'> {
    return this.database.db.transaction(async (transaction) => {
      // Serialize suite changes per workspace so concurrent requests cannot
      // both pass the bounded-case check.
      await transaction.execute(sql`
        select id
        from workspaces
        where id = ${input.workspaceId}
        for update
      `);
      const count = await transaction.execute<{ count: number }>(sql`
        select count(*)::integer as count
        from retrieval_evaluation_cases
        where workspace_id = ${input.workspaceId}
      `);
      if ((count.rows[0]?.count ?? 0) >= 20) return 'limit';

      const documents = await transaction.execute<{ title: string }>(sql`
        select document.title
        from knowledge_documents document
        join lateral (
          select version.status
          from knowledge_document_versions version
          where version.document_id = document.id
            and version.workspace_id = ${input.workspaceId}
          order by version.version desc
          limit 1
        ) version on true
        where document.id = ${input.expectedDocumentId}
          and document.workspace_id = ${input.workspaceId}
          and document.is_enabled = true
          and version.status = 'ready'
      `);
      const document = documents.rows[0];
      if (!document) return 'document_unavailable';

      const [created] = await transaction
        .insert(retrievalEvaluationCases)
        .values({
          createdByUserId: input.userId,
          expectedDocumentId: input.expectedDocumentId,
          question: input.question,
          workspaceId: input.workspaceId,
        })
        .returning();
      if (!created) throw new Error('Unable to create evaluation case.');
      return {
        createdAt: created.createdAt,
        expectedDocumentId: created.expectedDocumentId,
        expectedDocumentTitle: document.title,
        id: created.id,
        question: created.question,
      };
    });
  }

  async deleteCase(workspaceId: string, caseId: string): Promise<boolean> {
    const deleted = await this.database.db
      .delete(retrievalEvaluationCases)
      .where(
        and(
          eq(retrievalEvaluationCases.id, caseId),
          eq(retrievalEvaluationCases.workspaceId, workspaceId),
        ),
      )
      .returning({ id: retrievalEvaluationCases.id });
    return deleted.length === 1;
  }

  async listCases(workspaceId: string): Promise<RetrievalEvaluationCase[]> {
    return this.database.db
      .select({
        createdAt: retrievalEvaluationCases.createdAt,
        expectedDocumentId: retrievalEvaluationCases.expectedDocumentId,
        expectedDocumentTitle: knowledgeDocuments.title,
        id: retrievalEvaluationCases.id,
        question: retrievalEvaluationCases.question,
      })
      .from(retrievalEvaluationCases)
      .innerJoin(
        knowledgeDocuments,
        and(
          eq(
            knowledgeDocuments.id,
            retrievalEvaluationCases.expectedDocumentId,
          ),
          eq(knowledgeDocuments.workspaceId, workspaceId),
        ),
      )
      .where(eq(retrievalEvaluationCases.workspaceId, workspaceId))
      .orderBy(retrievalEvaluationCases.createdAt);
  }

  async listRuns(workspaceId: string): Promise<RetrievalEvaluationRun[]> {
    const runs = await this.database.db
      .select()
      .from(retrievalEvaluationRuns)
      .where(eq(retrievalEvaluationRuns.workspaceId, workspaceId))
      .orderBy(desc(retrievalEvaluationRuns.createdAt))
      .limit(10);
    if (runs.length === 0) return [];

    const runIds = runs.map(({ id }) => id);
    const rows = await this.database.db.execute<{
      caseId: string | null;
      expectedDocumentId: string | null;
      expectedDocumentTitle: string;
      id: string;
      question: string;
      reciprocalRank: number;
      retrievalMode: 'hybrid' | 'keyword';
      retrievedDocumentIds: string[];
      runId: string;
      wasHit: boolean;
    }>(sql`
      select
        id,
        run_id as "runId",
        case_id as "caseId",
        question_snapshot as question,
        expected_document_id as "expectedDocumentId",
        expected_document_title as "expectedDocumentTitle",
        retrieved_document_ids as "retrievedDocumentIds",
        retrieval_mode as "retrievalMode",
        reciprocal_rank as "reciprocalRank",
        was_hit as "wasHit"
      from retrieval_evaluation_results
      where workspace_id = ${workspaceId}
        and run_id = any(array[${sql.join(
          runIds.map((runId) => sql`${runId}`),
          sql`, `,
        )}]::uuid[])
      order by created_at, id
    `);

    return runs.map((run) => ({
      caseCount: run.caseCount,
      createdAt: run.createdAt,
      hitCount: run.hitCount,
      hitRate: run.hitRate,
      hybridCaseCount: run.hybridCaseCount,
      id: run.id,
      keywordOnlyCaseCount: run.keywordOnlyCaseCount,
      meanReciprocalRank: run.meanReciprocalRank,
      results: rows.rows.filter((result) => result.runId === run.id),
      topK: run.topK,
    }));
  }

  async saveRun(input: SaveEvaluationRun): Promise<RetrievalEvaluationRun> {
    return this.database.db.transaction(async (transaction) => {
      const runId = randomUUID();
      const hitCount = input.results.filter(({ wasHit }) => wasHit).length;
      const caseCount = input.results.length;
      const hitRate = hitCount / caseCount;
      const meanReciprocalRank =
        input.results.reduce((sum, result) => sum + result.reciprocalRank, 0) /
        caseCount;
      const [run] = await transaction
        .insert(retrievalEvaluationRuns)
        .values({
          caseCount,
          hitCount,
          hitRate,
          hybridCaseCount: input.hybridCaseCount,
          id: runId,
          keywordOnlyCaseCount: input.keywordOnlyCaseCount,
          meanReciprocalRank,
          requestedByUserId: input.requestedByUserId,
          topK: input.topK,
          workspaceId: input.workspaceId,
        })
        .returning();
      if (!run) throw new Error('Unable to persist evaluation run.');

      const results = await transaction
        .insert(retrievalEvaluationResults)
        .values(
          input.results.map((result) => ({
            caseId: result.caseId,
            expectedDocumentId: result.expectedDocumentId,
            expectedDocumentTitle: result.expectedDocumentTitle,
            questionSnapshot: result.question,
            reciprocalRank: result.reciprocalRank,
            retrievalMode: result.retrievalMode,
            retrievedDocumentIds: result.retrievedDocumentIds,
            runId,
            wasHit: result.wasHit,
            workspaceId: input.workspaceId,
          })),
        )
        .returning();

      return {
        caseCount,
        createdAt: run.createdAt,
        hitCount,
        hitRate,
        hybridCaseCount: input.hybridCaseCount,
        id: run.id,
        keywordOnlyCaseCount: input.keywordOnlyCaseCount,
        meanReciprocalRank,
        results: results.map((result) => ({
          caseId: result.caseId,
          expectedDocumentId: result.expectedDocumentId,
          expectedDocumentTitle: result.expectedDocumentTitle,
          id: result.id,
          question: result.questionSnapshot,
          reciprocalRank: result.reciprocalRank,
          retrievalMode: result.retrievalMode as 'hybrid' | 'keyword',
          retrievedDocumentIds: result.retrievedDocumentIds,
          wasHit: result.wasHit,
        })),
        topK: input.topK,
      };
    });
  }
}
