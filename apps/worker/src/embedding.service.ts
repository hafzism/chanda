import {
  createAiProviderClient,
  decryptAiCredential,
  getAiProviderModelConfiguration,
  parseAiCredentialEncryptionKey,
  type AiProvider,
} from '@suppline/ai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, workspaceAiConfigurations } from '@suppline/database';

import { DatabaseService } from './database.service';

export interface DocumentEmbeddingResult {
  dimensions: number;
  embeddingRevision: number;
  model: string;
  provider: AiProvider;
  vectors: number[][];
}

export interface EmbeddingProvider {
  embedDocuments(
    workspaceId: string,
    texts: string[],
  ): Promise<DocumentEmbeddingResult | null>;
}

@Injectable()
export class WorkspaceEmbeddingService implements EmbeddingProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async embedDocuments(
    workspaceId: string,
    texts: string[],
  ): Promise<DocumentEmbeddingResult | null> {
    if (texts.length === 0) return null;
    const records = await this.database.db
      .select()
      .from(workspaceAiConfigurations)
      .where(eq(workspaceAiConfigurations.workspaceId, workspaceId))
      .limit(1);
    const stored = records[0];
    if (!stored) return null;

    const expected = getAiProviderModelConfiguration(stored.provider);
    if (
      stored.embeddingModel !== expected.embeddingModel ||
      stored.embeddingDimensions !== expected.embeddingDimensions ||
      stored.generationModel !== expected.generationModel
    ) {
      throw new Error('The workspace AI provider must be revalidated.');
    }
    const encryptionKey = parseAiCredentialEncryptionKey(
      (
        this.config.get<string>('AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY') ?? ''
      ).trim(),
    );
    const apiKey = decryptAiCredential({
      encryptedApiKey: stored.encryptedApiKey,
      encryptionKey,
      provider: stored.provider,
      workspaceId,
    });
    const client = createAiProviderClient({
      apiKey,
      provider: stored.provider,
    });
    return {
      dimensions: expected.embeddingDimensions,
      embeddingRevision: stored.embeddingRevision,
      model: expected.embeddingModel,
      provider: stored.provider,
      vectors: await client.embedDocuments(texts),
    };
  }
}
