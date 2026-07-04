import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdf = vi.hoisted(() => ({
  getText: vi.fn<() => Promise<{ text: string }>>(),
}));

vi.mock('pdf-parse', () => ({
  PDFParse: class {
    getText = pdf.getText;
  },
}));

import {
  KnowledgeFileExtractor,
  MAX_KNOWLEDGE_FILE_BYTES,
} from '../src/knowledge/knowledge-file-extractor';

describe('KnowledgeFileExtractor', () => {
  const extractor = new KnowledgeFileExtractor();

  beforeEach(() => {
    pdf.getText.mockReset().mockResolvedValue({ text: 'Extracted PDF policy' });
  });

  it('decodes UTF-8 Markdown and derives a clean title', async () => {
    await expect(
      extractor.extract({
        buffer: Buffer.from('# Delivery\nOrders arrive in two days.'),
        mimetype: 'text/markdown',
        originalname: 'Delivery policy.md',
        size: 37,
      }),
    ).resolves.toEqual({
      content: '# Delivery\nOrders arrive in two days.',
      extension: '.md',
      mimeType: 'text/markdown',
      title: 'Delivery policy',
    });
  });

  it('extracts PDF text only when MIME and file signature agree', async () => {
    await expect(
      extractor.extract({
        buffer: Buffer.from('%PDF-1.7 content'),
        mimetype: 'application/pdf',
        originalname: 'Warranty.pdf',
        size: 16,
      }),
    ).resolves.toMatchObject({
      content: 'Extracted PDF policy',
      extension: '.pdf',
      title: 'Warranty',
    });
    expect(pdf.getText).toHaveBeenCalledOnce();
  });

  it.each([
    ['unsupported extension', 'policy.docx', 'application/octet-stream'],
    ['spoofed PDF', 'policy.pdf', 'application/pdf'],
  ])('rejects an %s', async (_name, originalname, mimetype) => {
    await expect(
      extractor.extract({
        buffer: Buffer.from('not a supported file'),
        mimetype,
        originalname,
        size: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized files before parsing', async () => {
    await expect(
      extractor.extract({
        buffer: Buffer.from('content'),
        mimetype: 'text/plain',
        originalname: 'large.txt',
        size: MAX_KNOWLEDGE_FILE_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid UTF-8 and binary text payloads', async () => {
    await expect(
      extractor.extract({
        buffer: Buffer.from([0xff, 0xfe]),
        mimetype: 'text/plain',
        originalname: 'invalid.txt',
        size: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      extractor.extract({
        buffer: Buffer.from('content\u0000binary'),
        mimetype: 'text/plain',
        originalname: 'binary.txt',
        size: 14,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
