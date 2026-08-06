import { Injectable } from '@nestjs/common';
import type { KnowledgeIndexJob } from '@suppline/contracts';
import {
  and,
  eq,
  knowledgeChunks,
  knowledgeDocumentVersions,
  ne,
  sql,
} from '@suppline/database';
import type { KnowledgeChunk } from '@suppline/knowledge';

import { DatabaseService } from './database.service';
import type { DocumentEmbeddingResult } from './embedding.service';

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
    embeddings: DocumentEmbeddingResult | null,
  ): Promise<void> {
    if (embeddings && chunks.length !== embeddings.vectors.length) {
      throw new Error('Chunk and embedding counts do not match.');
    }

    await this.database.db.transaction(async (transaction) => {
      await transaction
        .delete(knowledgeChunks)
        .where(
          and(
            eq(knowledgeChunks.documentVersionId, job.versionId),
            eq(knowledgeChunks.workspaceId, job.workspaceId),
          ),
        );
      if (chunks.length > 0) {
        await transaction.insert(knowledgeChunks).values(
          chunks.map((chunk, index) => ({
            characterEnd: chunk.characterEnd,
            characterStart: chunk.characterStart,
            content: chunk.content,
            contentHash: chunk.contentHash,
            documentId: job.documentId,
            documentVersionId: job.versionId,
            embedding: embeddings?.vectors[index] ?? null,
            estimatedTokenCount: chunk.estimatedTokenCount,
            heading: chunk.heading,
            ordinal: chunk.ordinal,
            workspaceId: job.workspaceId,
          })),
        );
      }

      const updated = await transaction.execute<
        { id: string } & Record<string, unknown>
      >(sql`
        update knowledge_document_versions version
        set
          chunk_count = ${chunks.length},
          embedding_dimensions = ${embeddings?.dimensions ?? null},
          embedding_model = ${embeddings?.model ?? null},
          embedding_provider = ${embeddings?.provider ?? null},
          indexed_at = now(),
          status = 'ready'
        where version.id = ${job.versionId}
          and version.workspace_id = ${job.workspaceId}
          and version.document_id = ${job.documentId}
          and (
            (
              ${embeddings === null}
              and not exists (
                select 1
                from workspace_ai_configurations configuration
                where configuration.workspace_id = ${job.workspaceId}
              )
            )
            or exists (
              select 1
              from workspace_ai_configurations configuration
              where configuration.workspace_id = ${job.workspaceId}
                and configuration.provider = ${embeddings?.provider ?? null}
                and configuration.embedding_model = ${embeddings?.model ?? null}
                and configuration.embedding_dimensions = ${embeddings?.dimensions ?? null}
                and configuration.embedding_revision = ${embeddings?.embeddingRevision ?? null}
            )
          )
        returning version.id
      `);
      if (updated.rows.length !== 1) {
        throw new Error(
          'The knowledge version or workspace AI provider changed during indexing.',
        );
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
          ne(knowledgeDocumentVersions.status, 'ready'),
        ),
      );
  }
}
