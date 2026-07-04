import { Injectable } from '@nestjs/common';
import type { KnowledgeIndexJob } from '@suppline/contracts';
import {
  and,
  eq,
  knowledgeChunks,
  knowledgeDocumentVersions,
  sql,
} from '@suppline/database';
import {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_PROVIDER,
  type KnowledgeChunk,
} from '@suppline/knowledge';

import { DatabaseService } from './database.service';

@Injectable()
export class KnowledgeIndexRepository {
  constructor(private readonly database: DatabaseService) {}

  async claim(job: KnowledgeIndexJob): Promise<boolean> {
    const result = await this.database.db.execute<{ id: string }>(sql`
      update knowledge_document_versions
      set
        status = 'processing',
        error_code = null,
        error_message = null
      where id = ${job.versionId}
        and workspace_id = ${job.workspaceId}
        and document_id = ${job.documentId}
        and coalesce(extracted_object_key, object_key) = ${job.objectKey}
        and status <> 'ready'
      returning id
    `);
    return result.rows.length === 1;
  }

  async complete(
    job: KnowledgeIndexJob,
    chunks: KnowledgeChunk[],
    embeddings: number[][],
  ): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunk and embedding counts do not match.');
    }

    await this.database.db.transaction(async (transaction) => {
      await transaction
        .delete(knowledgeChunks)
        .where(eq(knowledgeChunks.documentVersionId, job.versionId));
      if (chunks.length > 0) {
        await transaction.insert(knowledgeChunks).values(
          chunks.map((chunk, index) => ({
            characterEnd: chunk.characterEnd,
            characterStart: chunk.characterStart,
            content: chunk.content,
            contentHash: chunk.contentHash,
            documentId: job.documentId,
            documentVersionId: job.versionId,
            embedding: embeddings[index],
            estimatedTokenCount: chunk.estimatedTokenCount,
            heading: chunk.heading,
            ordinal: chunk.ordinal,
            workspaceId: job.workspaceId,
          })),
        );
      }

      const updated = await transaction
        .update(knowledgeDocumentVersions)
        .set({
          chunkCount: chunks.length,
          embeddingDimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
          embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
          embeddingProvider: KNOWLEDGE_EMBEDDING_PROVIDER,
          indexedAt: new Date(),
          status: 'ready',
        })
        .where(
          and(
            eq(knowledgeDocumentVersions.id, job.versionId),
            eq(knowledgeDocumentVersions.workspaceId, job.workspaceId),
            eq(knowledgeDocumentVersions.documentId, job.documentId),
          ),
        )
        .returning({ id: knowledgeDocumentVersions.id });
      if (updated.length !== 1) {
        throw new Error('Knowledge version disappeared during indexing.');
      }
    });
  }

  async fail(job: KnowledgeIndexJob, message: string): Promise<void> {
    await this.database.db
      .update(knowledgeDocumentVersions)
      .set({
        errorCode: 'indexing_failed',
        errorMessage: message,
        status: 'failed',
      })
      .where(
        and(
          eq(knowledgeDocumentVersions.id, job.versionId),
          eq(knowledgeDocumentVersions.workspaceId, job.workspaceId),
          eq(knowledgeDocumentVersions.documentId, job.documentId),
        ),
      );
  }
}
