import { Injectable } from '@nestjs/common';
import {
  and,
  eq,
  knowledgeDocuments,
  knowledgeDocumentVersions,
  outboxEvents,
  sql,
} from '@suppline/database';
import { KNOWLEDGE_VERSION_INDEX_REQUESTED } from '@suppline/contracts';
import {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_PROVIDER,
} from '@suppline/knowledge';

import { DatabaseService } from '../database/database.service';
import type {
  CreateArticleRecord,
  KnowledgeDocumentSummary,
  KnowledgeRetrievalHit,
  KnowledgeRepository,
} from './knowledge.types';

type KnowledgeDocumentRow = KnowledgeDocumentSummary & Record<string, unknown>;
type RetrievalRow = KnowledgeRetrievalHit & Record<string, unknown>;

@Injectable()
export class DrizzleKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly database: DatabaseService) {}

  async createQueuedArticle(
    input: CreateArticleRecord,
  ): Promise<KnowledgeDocumentSummary> {
    return this.database.db.transaction(async (transaction) => {
      const [document] = await transaction
        .insert(knowledgeDocuments)
        .values({
          createdByUserId: input.userId,
          id: input.documentId,
          sourceKind: 'article',
          title: input.title,
          workspaceId: input.workspaceId,
        })
        .returning();

      if (!document) throw new Error('Unable to create knowledge document.');

      const [version] = await transaction
        .insert(knowledgeDocumentVersions)
        .values({
          byteSize: input.byteSize,
          contentHash: input.contentHash,
          createdByUserId: input.userId,
          documentId: input.documentId,
          id: input.versionId,
          mimeType: 'text/markdown',
          objectKey: input.objectKey,
          status: 'queued',
          version: 1,
          workspaceId: input.workspaceId,
        })
        .returning();

      if (!version) throw new Error('Unable to create knowledge version.');

      return {
        chunkCount: version.chunkCount,
        createdAt: document.createdAt,
        id: document.id,
        isEnabled: document.isEnabled,
        mimeType: version.mimeType,
        sourceKind: document.sourceKind,
        status: version.status,
        title: document.title,
        updatedAt: document.updatedAt,
        version: version.version,
        versionId: version.id,
      };
    });
  }

  async list(workspaceId: string): Promise<KnowledgeDocumentSummary[]> {
    const result = await this.database.db.execute<KnowledgeDocumentRow>(sql`
      select
        document.id,
        document.title,
        document.source_kind as "sourceKind",
        document.is_enabled as "isEnabled",
        document.created_at as "createdAt",
        document.updated_at as "updatedAt",
        version.id as "versionId",
        version.version,
        version.mime_type as "mimeType",
        version.status,
        version.chunk_count as "chunkCount"
      from knowledge_documents document
      join lateral (
        select candidate.*
        from knowledge_document_versions candidate
        where candidate.document_id = document.id
        order by candidate.version desc
        limit 1
      ) version on true
      where document.workspace_id = ${workspaceId}
      order by document.updated_at desc, document.id
    `);

    return result.rows;
  }

  async deleteDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<string[] | null> {
    return this.database.db.transaction(async (transaction) => {
      const versions = await transaction
        .select({ objectKey: knowledgeDocumentVersions.objectKey })
        .from(knowledgeDocumentVersions)
        .where(
          and(
            eq(knowledgeDocumentVersions.workspaceId, workspaceId),
            eq(knowledgeDocumentVersions.documentId, documentId),
          ),
        );
      if (versions.length === 0) return null;

      const deleted = await transaction
        .delete(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.id, documentId),
            eq(knowledgeDocuments.workspaceId, workspaceId),
          ),
        )
        .returning({ id: knowledgeDocuments.id });
      if (deleted.length !== 1) return null;
      return versions.map((version) => version.objectKey);
    });
  }

  async markVersionFailed(
    versionId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.database.db
      .update(knowledgeDocumentVersions)
      .set({ errorCode, errorMessage, status: 'failed' })
      .where(eq(knowledgeDocumentVersions.id, versionId));
  }

  async keywordSearch(
    workspaceId: string,
    query: string,
  ): Promise<KnowledgeRetrievalHit[]> {
    const result = await this.database.db.execute<RetrievalRow>(sql`
      select
        chunk.id as "chunkId",
        ts_rank_cd(
          to_tsvector('english', chunk.content),
          websearch_to_tsquery('english', ${query})
        )::double precision as "providerScore",
        jsonb_build_object(
          'characterEnd', chunk.character_end,
          'characterStart', chunk.character_start,
          'content', chunk.content,
          'documentId', document.id,
          'heading', chunk.heading,
          'title', document.title,
          'versionId', version.id
        ) as metadata
      from knowledge_chunks chunk
      join knowledge_document_versions version
        on version.id = chunk.document_version_id
      join knowledge_documents document on document.id = chunk.document_id
      where chunk.workspace_id = ${workspaceId}
        and version.workspace_id = ${workspaceId}
        and document.workspace_id = ${workspaceId}
        and document.is_enabled = true
        and version.status = 'ready'
        and to_tsvector('english', chunk.content)
          @@ websearch_to_tsquery('english', ${query})
      order by "providerScore" desc, chunk.id
      limit 30
    `);
    return result.rows;
  }

  async semanticSearch(
    workspaceId: string,
    embedding: number[],
  ): Promise<KnowledgeRetrievalHit[]> {
    const serialized = JSON.stringify(embedding);
    const result = await this.database.db.execute<RetrievalRow>(sql`
      select
        chunk.id as "chunkId",
        (1 - (chunk.embedding <=> ${serialized}::vector))::double precision
          as "providerScore",
        jsonb_build_object(
          'characterEnd', chunk.character_end,
          'characterStart', chunk.character_start,
          'content', chunk.content,
          'documentId', document.id,
          'heading', chunk.heading,
          'title', document.title,
          'versionId', version.id
        ) as metadata
      from knowledge_chunks chunk
      join knowledge_document_versions version
        on version.id = chunk.document_version_id
      join knowledge_documents document on document.id = chunk.document_id
      where chunk.workspace_id = ${workspaceId}
        and version.workspace_id = ${workspaceId}
        and document.workspace_id = ${workspaceId}
        and document.is_enabled = true
        and version.status = 'ready'
        and version.embedding_provider = ${KNOWLEDGE_EMBEDDING_PROVIDER}
        and version.embedding_model = ${KNOWLEDGE_EMBEDDING_MODEL}
        and version.embedding_dimensions = ${KNOWLEDGE_EMBEDDING_DIMENSIONS}
        and chunk.embedding is not null
      order by chunk.embedding <=> ${serialized}::vector, chunk.id
      limit 30
    `);
    return result.rows;
  }

  async scheduleVersionIndexing(input: {
    documentId: string;
    objectKey: string;
    versionId: string;
    workspaceId: string;
  }): Promise<void> {
    await this.database.db.insert(outboxEvents).values({
      aggregateId: input.versionId,
      payload: input,
      topic: KNOWLEDGE_VERSION_INDEX_REQUESTED,
      workspaceId: input.workspaceId,
    });
  }

  async setEnabled(
    workspaceId: string,
    documentId: string,
    isEnabled: boolean,
  ): Promise<boolean> {
    const updated = await this.database.db
      .update(knowledgeDocuments)
      .set({ isEnabled, updatedAt: new Date() })
      .where(
        and(
          eq(knowledgeDocuments.id, documentId),
          eq(knowledgeDocuments.workspaceId, workspaceId),
        ),
      )
      .returning({ id: knowledgeDocuments.id });

    return updated.length === 1;
  }
}
