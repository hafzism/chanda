import type { AiProvider } from '@suppline/ai';

export interface StoredAiConfiguration {
  apiKeyFingerprint: string;
  configuredByUserId: string;
  createdAt: Date;
  embeddingDimensions: number;
  embeddingModel: string;
  embeddingRevision: number;
  encryptedApiKey: string;
  encryptionKeyVersion: number;
  generationModel: string;
  provider: AiProvider;
  updatedAt: Date;
  validatedAt: Date;
  workspaceId: string;
}

export interface AiConfigurationSummary {
  configured: boolean;
  embeddingDimensions: number | null;
  embeddingModel: string | null;
  generationModel: string | null;
  provider: AiProvider | null;
  updatedAt: Date | null;
  validatedAt: Date | null;
}

export interface AiConfigurationRepository {
  delete(workspaceId: string): Promise<boolean>;
  find(workspaceId: string): Promise<StoredAiConfiguration | null>;
  save(input: {
    apiKeyFingerprint: string;
    configuredByUserId: string;
    embeddingDimensions: number;
    embeddingModel: string;
    encryptedApiKey: string;
    encryptionKeyVersion: number;
    generationModel: string;
    provider: AiProvider;
    validatedAt: Date;
    workspaceId: string;
  }): Promise<StoredAiConfiguration>;
}
