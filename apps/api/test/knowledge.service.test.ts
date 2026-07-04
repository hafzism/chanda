import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { KnowledgeService } from '../src/knowledge/knowledge.service';
import type {
  KnowledgeDocumentSummary,
  KnowledgeRepository,
} from '../src/knowledge/knowledge.types';
import type { ObjectStorage } from '../src/storage/storage.types';

const summary: KnowledgeDocumentSummary = {
  chunkCount: 0,
  createdAt: new Date('2026-07-13T00:00:00.000Z'),
  id: 'document-1',
  isEnabled: true,
  mimeType: 'text/markdown',
  sourceKind: 'article',
  status: 'queued',
  title: 'Returns policy',
  updatedAt: new Date('2026-07-13T00:00:00.000Z'),
  version: 1,
  versionId: 'version-1',
};

describe('KnowledgeService', () => {
  let createMock: MockedFunction<KnowledgeRepository['createQueuedArticle']>;
  let createFileMock: MockedFunction<KnowledgeRepository['createQueuedFile']>;
  let deleteDocumentMock: MockedFunction<KnowledgeRepository['deleteDocument']>;
  let listMock: MockedFunction<KnowledgeRepository['list']>;
  let listChunksMock: MockedFunction<KnowledgeRepository['listChunks']>;
  let keywordSearchMock: MockedFunction<KnowledgeRepository['keywordSearch']>;
  let markFailedMock: MockedFunction<KnowledgeRepository['markVersionFailed']>;
  let scheduleMock: MockedFunction<
    KnowledgeRepository['scheduleVersionIndexing']
  >;
  let semanticSearchMock: MockedFunction<KnowledgeRepository['semanticSearch']>;
  let reindexMock: MockedFunction<KnowledgeRepository['reindexDocument']>;
  const embedQueryMock = vi.fn<(query: string) => Promise<number[]>>();
  let setEnabledMock: MockedFunction<KnowledgeRepository['setEnabled']>;
  let deleteMock: MockedFunction<ObjectStorage['delete']>;
  let putTextMock: MockedFunction<ObjectStorage['putText']>;
  let putBytesMock: MockedFunction<ObjectStorage['putBytes']>;
  let service: KnowledgeService;

  beforeEach(() => {
    createMock = vi
      .fn<KnowledgeRepository['createQueuedArticle']>()
      .mockResolvedValue(summary);
    createFileMock = vi
      .fn<KnowledgeRepository['createQueuedFile']>()
      .mockResolvedValue({
        ...summary,
        mimeType: 'text/plain',
        sourceKind: 'file',
      });
    deleteDocumentMock = vi
      .fn<KnowledgeRepository['deleteDocument']>()
      .mockResolvedValue(['workspaces/workspace-1/source.md']);
    listMock = vi.fn<KnowledgeRepository['list']>().mockResolvedValue([]);
    listChunksMock = vi
      .fn<KnowledgeRepository['listChunks']>()
      .mockResolvedValue({ chunks: [], status: 'ready' });
    keywordSearchMock = vi
      .fn<KnowledgeRepository['keywordSearch']>()
      .mockResolvedValue([]);
    markFailedMock = vi
      .fn<KnowledgeRepository['markVersionFailed']>()
      .mockResolvedValue(undefined);
    setEnabledMock = vi
      .fn<KnowledgeRepository['setEnabled']>()
      .mockResolvedValue(true);
    scheduleMock = vi
      .fn<KnowledgeRepository['scheduleVersionIndexing']>()
      .mockResolvedValue(undefined);
    semanticSearchMock = vi
      .fn<KnowledgeRepository['semanticSearch']>()
      .mockResolvedValue([]);
    reindexMock = vi
      .fn<KnowledgeRepository['reindexDocument']>()
      .mockResolvedValue('queued');
    embedQueryMock.mockResolvedValue([0.1, 0.2]);
    putTextMock = vi
      .fn<ObjectStorage['putText']>()
      .mockResolvedValue(undefined);
    putBytesMock = vi
      .fn<ObjectStorage['putBytes']>()
      .mockResolvedValue(undefined);
    deleteMock = vi.fn<ObjectStorage['delete']>().mockResolvedValue(undefined);
    service = new KnowledgeService(
      {
        createQueuedArticle: createMock,
        createQueuedFile: createFileMock,
        deleteDocument: deleteDocumentMock,
        keywordSearch: keywordSearchMock,
        list: listMock,
        listChunks: listChunksMock,
        markVersionFailed: markFailedMock,
        scheduleVersionIndexing: scheduleMock,
        semanticSearch: semanticSearchMock,
        reindexDocument: reindexMock,
        setEnabled: setEnabledMock,
      },
      {
        delete: deleteMock,
        getText: vi.fn(),
        putBytes: putBytesMock,
        putText: putTextMock,
      },
      { embedQuery: embedQueryMock },
    );
  });

  it('normalizes and stores a versioned article behind its content hash', async () => {
    await expect(
      service.createArticle('workspace-1', 'user-1', {
        content: '# Returns\r\n\r\nItems can be returned within 30 days.  ',
        title: '  Returns policy  ',
      }),
    ).resolves.toBe(summary);

    const normalizedContent =
      '# Returns\n\nItems can be returned within 30 days.';
    const createInput = createMock.mock.calls[0]?.[0];
    const scheduleInput = scheduleMock.mock.calls[0]?.[0];
    const storageInput = putTextMock.mock.calls[0]?.[0];

    expect(createInput).toMatchObject({
      byteSize: Buffer.byteLength(normalizedContent, 'utf8'),
      title: 'Returns policy',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
    expect(createInput?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storageInput).toMatchObject({ content: normalizedContent });
    expect(storageInput?.contentHash).toBe(createInput?.contentHash);
    expect(scheduleInput).toEqual({
      documentId: createInput?.documentId,
      objectKey: storageInput?.key,
      versionId: createInput?.versionId,
      workspaceId: 'workspace-1',
    });
  });

  it('rejects duplicate workspace content', async () => {
    createMock.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: '23505' }),
    );

    await expect(
      service.createArticle('workspace-1', 'user-1', {
        content: 'This article contains enough content to pass validation.',
        title: 'Duplicate',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(putTextMock).not.toHaveBeenCalled();
  });

  it('preserves an uploaded file and indexes its normalized extracted text', async () => {
    const file = {
      buffer: Buffer.from(
        'Returns\r\n\r\nItems can be returned within 30 days.  ',
      ),
      mimetype: 'text/plain',
      originalname: 'Returns policy.txt',
      size: 52,
    };

    await expect(
      service.createFile('workspace-1', 'user-1', file),
    ).resolves.toMatchObject({ sourceKind: 'file' });

    const createInput = createFileMock.mock.calls[0]?.[0];
    const originalInput = putBytesMock.mock.calls[0]?.[0];
    const extractedInput = putTextMock.mock.calls[0]?.[0];

    expect(createInput).toMatchObject({
      byteSize: file.size,
      mimeType: 'text/plain',
      originalFileName: file.originalname,
      title: 'Returns policy',
    });
    expect(originalInput).toMatchObject({
      content: file.buffer,
      contentType: 'text/plain',
      key: createInput?.objectKey,
    });
    expect(extractedInput).toMatchObject({
      content: 'Returns\n\nItems can be returned within 30 days.',
      key: createInput?.extractedObjectKey,
    });
    expect(scheduleMock).toHaveBeenCalledWith({
      documentId: createInput?.documentId,
      objectKey: createInput?.extractedObjectKey,
      versionId: createInput?.versionId,
      workspaceId: 'workspace-1',
    });
  });

  it('rejects an uploaded file without meaningful extractable text', async () => {
    await expect(
      service.createFile('workspace-1', 'user-1', {
        buffer: Buffer.from('too short'),
        mimetype: 'text/plain',
        originalname: 'empty.txt',
        size: 9,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createFileMock).not.toHaveBeenCalled();
    expect(putBytesMock).not.toHaveBeenCalled();
  });

  it('cleans up both file objects when upload scheduling fails', async () => {
    scheduleMock.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.createFile('workspace-1', 'user-1', {
        buffer: Buffer.from(
          'This file has enough approved content for indexing.',
        ),
        mimetype: 'text/markdown',
        originalname: 'approved.md',
        size: 51,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(markFailedMock).toHaveBeenCalledWith(
      expect.any(String),
      'index_schedule_failed',
      'database unavailable',
    );
  });

  it('rejects content that becomes empty after normalization', async () => {
    await expect(
      service.createArticle('workspace-1', 'user-1', {
        content: '\u0000'.repeat(20),
        title: 'Empty after normalization',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('records a failed version when object storage is unavailable', async () => {
    putTextMock.mockRejectedValue(new Error('storage offline'));

    await expect(
      service.createArticle('workspace-1', 'user-1', {
        content: 'This article contains enough content to pass validation.',
        title: 'Storage failure',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(markFailedMock).toHaveBeenCalledWith(
      expect.any(String),
      'storage_write_failed',
      'storage offline',
    );
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('removes the stored object when durable scheduling fails', async () => {
    scheduleMock.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.createArticle('workspace-1', 'user-1', {
        content: 'This article contains enough content to pass validation.',
        title: 'Scheduling failure',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(deleteMock).toHaveBeenCalledOnce();
    expect(markFailedMock).toHaveBeenCalledWith(
      expect.any(String),
      'index_schedule_failed',
      'database unavailable',
    );
  });

  it('fails closed when toggling a document outside the workspace', async () => {
    setEnabledMock.mockResolvedValue(false);

    await expect(
      service.setEnabled('workspace-1', 'document-1', false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes stored objects after tenant-scoped document deletion', async () => {
    await service.deleteDocument('workspace-1', 'document-1');

    expect(deleteDocumentMock).toHaveBeenCalledWith(
      'workspace-1',
      'document-1',
    );
    expect(deleteMock).toHaveBeenCalledWith('workspaces/workspace-1/source.md');
  });

  it('does not touch storage for a document outside the workspace', async () => {
    deleteDocumentMock.mockResolvedValue(null);

    await expect(
      service.deleteDocument('workspace-1', 'document-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('returns exact stored chunks for source inspection', async () => {
    listChunksMock.mockResolvedValue({
      chunks: [
        {
          characterEnd: 42,
          characterStart: 0,
          content: 'Returns are accepted within 30 days.',
          heading: 'Returns',
          id: 'chunk-1',
          ordinal: 0,
        },
      ],
      status: 'ready',
    });

    await expect(
      service.listChunks('workspace-1', 'document-1'),
    ).resolves.toMatchObject({ status: 'ready', chunks: [{ id: 'chunk-1' }] });
    expect(listChunksMock).toHaveBeenCalledWith('workspace-1', 'document-1');
  });

  it('rejects a concurrent re-index request without scheduling twice', async () => {
    reindexMock.mockResolvedValue('busy');

    await expect(
      service.reindexDocument('workspace-1', 'document-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fuses keyword and semantic evidence with citation metadata', async () => {
    const metadata = {
      characterEnd: 42,
      characterStart: 10,
      content: 'Returns are accepted within 30 days.',
      documentId: 'document-1',
      heading: 'Returns',
      title: 'Returns policy',
      versionId: 'version-1',
    };
    keywordSearchMock.mockResolvedValue([
      { chunkId: 'chunk-1', metadata, providerScore: 0.8 },
    ]);
    semanticSearchMock.mockResolvedValue([
      { chunkId: 'chunk-1', metadata, providerScore: 0.9 },
    ]);

    const result = await service.search('workspace-1', {
      maxResults: 4,
      query: 'Can I return an item?',
    });

    expect(result.mode).toBe('hybrid');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      chunkId: 'chunk-1',
      keywordRank: 1,
      metadata,
      semanticRank: 1,
    });
  });

  it('reports keyword-only mode when query embeddings are unavailable', async () => {
    embedQueryMock.mockRejectedValue(new Error('provider offline'));

    const result = await service.search('workspace-1', {
      query: 'return window',
    });

    expect(result.mode).toBe('keyword');
    expect(semanticSearchMock).not.toHaveBeenCalled();
  });
});
