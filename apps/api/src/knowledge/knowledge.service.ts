import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  fuseRetrievalResults,
  normalizeKnowledgeText,
} from '@suppline/knowledge';

import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.types';
import type { CreateArticleDto } from './dto/create-article.dto';
import {
  KnowledgeFileExtractor,
  type UploadedKnowledgeFile,
} from './knowledge-file-extractor';
import type { SearchKnowledgeDto } from './dto/search-knowledge.dto';
import type {
  KnowledgeDocumentSummary,
  KnowledgeRepository,
} from './knowledge.types';
import type { QueryEmbeddingProvider } from './query-embedding.service';

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');
export const QUERY_EMBEDDING_PROVIDER = Symbol('QUERY_EMBEDDING_PROVIDER');

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly fileExtractor = new KnowledgeFileExtractor();

  constructor(
    @Inject(KNOWLEDGE_REPOSITORY)
    private readonly repository: KnowledgeRepository,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorage,
    @Inject(QUERY_EMBEDDING_PROVIDER)
    private readonly queryEmbeddings: QueryEmbeddingProvider,
  ) {}

  list(workspaceId: string): Promise<KnowledgeDocumentSummary[]> {
    return this.repository.list(workspaceId);
  }

  async listChunks(workspaceId: string, documentId: string) {
    const inspection = await this.repository.listChunks(
      workspaceId,
      documentId,
    );
    if (!inspection)
      throw new NotFoundException('Knowledge document not found.');
    return inspection;
  }

  async search(workspaceId: string, input: SearchKnowledgeDto) {
    const query = normalizeKnowledgeText(input.query);
    const keyword = await this.repository.keywordSearch(workspaceId, query);
    let semantic: Awaited<ReturnType<KnowledgeRepository['semanticSearch']>> =
      [];
    let mode: 'hybrid' | 'keyword' = 'hybrid';

    try {
      semantic = await this.repository.semanticSearch(
        workspaceId,
        await this.queryEmbeddings.embedQuery(query),
      );
    } catch (error: unknown) {
      mode = 'keyword';
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Semantic retrieval unavailable; using keyword evidence: ${reason}`,
      );
    }

    return {
      mode,
      results: fuseRetrievalResults(keyword, semantic, {
        limit: input.maxResults ?? 6,
      }),
    };
  }

  async deleteDocument(workspaceId: string, documentId: string): Promise<void> {
    const objectKeys = await this.repository.deleteDocument(
      workspaceId,
      documentId,
    );
    if (!objectKeys) {
      throw new NotFoundException('Knowledge document not found.');
    }
    await Promise.allSettled(objectKeys.map((key) => this.storage.delete(key)));
  }

  async createArticle(
    workspaceId: string,
    userId: string,
    input: CreateArticleDto,
  ): Promise<KnowledgeDocumentSummary> {
    const content = normalizeKnowledgeText(input.content);
    const title = input.title.trim();

    if (title.length < 2) {
      throw new BadRequestException(
        'Article title must contain at least 2 characters.',
      );
    }
    if (content.length < 20) {
      throw new BadRequestException(
        'Article content must contain at least 20 meaningful characters.',
      );
    }

    const contentHash = createHash('sha256').update(content).digest('hex');
    const documentId = randomUUID();
    const versionId = randomUUID();
    const objectKey = `workspaces/${workspaceId}/knowledge/${documentId}/${versionId}.md`;
    let document: KnowledgeDocumentSummary;

    try {
      document = await this.repository.createQueuedArticle({
        byteSize: Buffer.byteLength(content, 'utf8'),
        contentHash,
        documentId,
        objectKey,
        title,
        userId,
        versionId,
        workspaceId,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This workspace already contains the same knowledge content.',
        );
      }
      throw error;
    }

    try {
      await this.storage.putText({ content, contentHash, key: objectKey });
    } catch (error: unknown) {
      await this.repository.markVersionFailed(
        versionId,
        'storage_write_failed',
        error instanceof Error ? error.message : 'Object storage write failed.',
      );
      throw new ServiceUnavailableException(
        'Knowledge storage is temporarily unavailable.',
      );
    }

    try {
      await this.repository.scheduleVersionIndexing({
        documentId,
        objectKey,
        versionId,
        workspaceId,
      });
    } catch (error: unknown) {
      await Promise.allSettled([
        this.storage.delete(objectKey),
        this.repository.markVersionFailed(
          versionId,
          'index_schedule_failed',
          error instanceof Error
            ? error.message
            : 'Knowledge indexing could not be scheduled.',
        ),
      ]);
      throw new ServiceUnavailableException(
        'Knowledge indexing is temporarily unavailable.',
      );
    }

    return document;
  }

  async createFile(
    workspaceId: string,
    userId: string,
    file?: UploadedKnowledgeFile,
  ): Promise<KnowledgeDocumentSummary> {
    if (!file) throw new BadRequestException('Choose a knowledge file.');

    const extracted = await this.fileExtractor.extract(file);
    const content = normalizeKnowledgeText(extracted.content);
    if (content.length < 20) {
      throw new BadRequestException(
        'The file must contain at least 20 meaningful characters. Image-only PDFs are not supported.',
      );
    }

    const contentHash = createHash('sha256').update(content).digest('hex');
    const originalHash = createHash('sha256').update(file.buffer).digest('hex');
    const documentId = randomUUID();
    const versionId = randomUUID();
    const prefix = `workspaces/${workspaceId}/knowledge/${documentId}/${versionId}`;
    const objectKey = `${prefix}/source${extracted.extension}`;
    const extractedObjectKey = `${prefix}/extracted.md`;
    let document: KnowledgeDocumentSummary;

    try {
      document = await this.repository.createQueuedFile({
        byteSize: file.size,
        contentHash,
        documentId,
        extractedObjectKey,
        mimeType: extracted.mimeType,
        objectKey,
        originalFileName: file.originalname,
        title: extracted.title,
        userId,
        versionId,
        workspaceId,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This workspace already contains the same knowledge content.',
        );
      }
      throw error;
    }

    try {
      await this.storage.putBytes({
        content: file.buffer,
        contentHash: originalHash,
        contentType: extracted.mimeType,
        key: objectKey,
      });
      await this.storage.putText({
        content,
        contentHash,
        key: extractedObjectKey,
      });
    } catch (error: unknown) {
      await Promise.allSettled([
        this.storage.delete(objectKey),
        this.storage.delete(extractedObjectKey),
        this.repository.markVersionFailed(
          versionId,
          'storage_write_failed',
          error instanceof Error
            ? error.message
            : 'Object storage write failed.',
        ),
      ]);
      throw new ServiceUnavailableException(
        'Knowledge storage is temporarily unavailable.',
      );
    }

    try {
      await this.repository.scheduleVersionIndexing({
        documentId,
        objectKey: extractedObjectKey,
        versionId,
        workspaceId,
      });
    } catch (error: unknown) {
      await Promise.allSettled([
        this.storage.delete(objectKey),
        this.storage.delete(extractedObjectKey),
        this.repository.markVersionFailed(
          versionId,
          'index_schedule_failed',
          error instanceof Error
            ? error.message
            : 'Knowledge indexing could not be scheduled.',
        ),
      ]);
      throw new ServiceUnavailableException(
        'Knowledge indexing is temporarily unavailable.',
      );
    }

    return document;
  }

  async setEnabled(
    workspaceId: string,
    documentId: string,
    isEnabled: boolean,
  ): Promise<void> {
    const updated = await this.repository.setEnabled(
      workspaceId,
      documentId,
      isEnabled,
    );
    if (!updated) throw new NotFoundException('Knowledge document not found.');
  }

  async reindexDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<void> {
    const result = await this.repository.reindexDocument(
      workspaceId,
      documentId,
    );
    if (!result) throw new NotFoundException('Knowledge document not found.');
    if (result === 'busy') {
      throw new ConflictException('This knowledge source is already indexing.');
    }
  }
}
