import { extname } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

export const MAX_KNOWLEDGE_FILE_BYTES = 8 * 1024 * 1024;

export interface UploadedKnowledgeFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ExtractedKnowledgeFile {
  content: string;
  extension: '.md' | '.pdf' | '.txt';
  mimeType: 'application/pdf' | 'text/markdown' | 'text/plain';
  title: string;
}

@Injectable()
export class KnowledgeFileExtractor {
  async extract(file: UploadedKnowledgeFile): Promise<ExtractedKnowledgeFile> {
    if (!file.buffer.length || file.size === 0) {
      throw new BadRequestException('Choose a non-empty knowledge file.');
    }
    if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
      throw new BadRequestException('Knowledge files must be 8 MB or smaller.');
    }

    const extension = extname(file.originalname).toLowerCase();
    const title = file.originalname.slice(0, -extension.length).trim();
    if (!title || title.length > 120) {
      throw new BadRequestException(
        'The file name must contain a title of 120 characters or fewer.',
      );
    }

    if (extension === '.pdf') {
      if (
        file.mimetype !== 'application/pdf' ||
        file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
      ) {
        throw new BadRequestException('The uploaded file is not a valid PDF.');
      }
      return {
        content: await this.extractPdf(file.buffer),
        extension,
        mimeType: 'application/pdf',
        title,
      };
    }

    if (extension !== '.txt' && extension !== '.md') {
      throw new BadRequestException('Upload a PDF, TXT, or Markdown file.');
    }
    if (
      !['text/plain', 'text/markdown', 'application/octet-stream'].includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException('The uploaded text file type is invalid.');
    }

    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException('Text files must use UTF-8 encoding.');
    }
    if (content.includes('\u0000')) {
      throw new BadRequestException('The uploaded text file is invalid.');
    }
    return {
      content,
      extension,
      mimeType: extension === '.md' ? 'text/markdown' : 'text/plain',
      title,
    };
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } catch {
      throw new BadRequestException(
        'Chanda could not extract text from this PDF. Password-protected or damaged PDFs are not supported.',
      );
    }
  }
}
