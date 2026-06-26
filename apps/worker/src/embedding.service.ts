import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
} from '@suppline/knowledge';

export interface EmbeddingProvider {
  embedDocuments(texts: string[]): Promise<number[][]>;
}

@Injectable()
export class GeminiEmbeddingService implements EmbeddingProvider {
  private client: GoogleGenAI | null = null;

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.getClient().models.embedContent({
      config: { outputDimensionality: KNOWLEDGE_EMBEDDING_DIMENSIONS },
      contents: texts.map((text) => ({
        parts: [
          {
            text: `Represent this customer-support knowledge for retrieval.\n\n${text}`,
          },
        ],
        role: 'user',
      })),
      model: KNOWLEDGE_EMBEDDING_MODEL,
    });
    const vectors = response.embeddings?.map((embedding) => embedding.values);
    if (
      !vectors ||
      vectors.length !== texts.length ||
      vectors.some(
        (vector) =>
          !vector ||
          vector.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS ||
          vector.some((value) => !Number.isFinite(value)),
      )
    ) {
      throw new Error('The embedding provider returned an invalid vector set.');
    }
    return vectors as number[][];
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }
}
