import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
} from '@suppline/knowledge';

export interface QueryEmbeddingProvider {
  embedQuery(query: string): Promise<number[]>;
}

@Injectable()
export class GeminiQueryEmbeddingService implements QueryEmbeddingProvider {
  private client: GoogleGenAI | null = null;

  async embedQuery(query: string): Promise<number[]> {
    const response = await this.getClient().models.embedContent({
      config: { outputDimensionality: KNOWLEDGE_EMBEDDING_DIMENSIONS },
      contents: `Retrieve customer-support evidence that answers this request.\n\n${query}`,
      model: KNOWLEDGE_EMBEDDING_MODEL,
    });
    const vector = response.embeddings?.[0]?.values;
    if (
      !vector ||
      vector.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS ||
      vector.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(
        'The embedding provider returned an invalid query vector.',
      );
    }
    return vector;
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }
}
