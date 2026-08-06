import {
  fingerprintAiCredential,
  getAiProviderModelConfiguration,
  type AiProvider,
  type AiProviderClient,
} from '@suppline/ai';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AiCredentialCipherService } from './ai-credential-cipher.service';
import { AiProviderClientFactory } from './ai-provider-client.factory';
import type {
  AiConfigurationRepository,
  AiConfigurationSummary,
  StoredAiConfiguration,
} from './ai-configuration.types';

export const AI_CONFIGURATION_REPOSITORY = Symbol(
  'AI_CONFIGURATION_REPOSITORY',
);

export class AiProviderNotConfiguredError extends Error {
  constructor() {
    super('This workspace does not have an AI provider configured.');
    this.name = 'AiProviderNotConfiguredError';
  }
}

export interface ResolvedAiProvider {
  client: AiProviderClient;
  embeddingRevision: number;
  provider: AiProvider;
}

@Injectable()
export class AiConfigurationService {
  constructor(
    @Inject(AI_CONFIGURATION_REPOSITORY)
    private readonly repository: AiConfigurationRepository,
    private readonly cipher: AiCredentialCipherService,
    private readonly clients: AiProviderClientFactory,
  ) {}

  async summary(workspaceId: string): Promise<AiConfigurationSummary> {
    const configuration = await this.repository.find(workspaceId);
    return configuration
      ? this.toSummary(configuration)
      : {
          configured: false,
          embeddingDimensions: null,
          embeddingModel: null,
          generationModel: null,
          provider: null,
          updatedAt: null,
          validatedAt: null,
        };
  }

  async configure(input: {
    apiKey: string;
    configuredByUserId: string;
    provider: AiProvider;
    workspaceId: string;
  }): Promise<AiConfigurationSummary> {
    const apiKey = input.apiKey.trim();
    const models = getAiProviderModelConfiguration(input.provider);
    const client = this.clients.create({ apiKey, provider: input.provider });
    try {
      await client.validateConnection();
    } catch (error: unknown) {
      if (isCredentialRejection(error)) {
        throw new BadRequestException(
          'The provider rejected this key, its quota is unavailable, or the required models are not enabled.',
        );
      }
      throw new ServiceUnavailableException(
        'The AI provider could not be reached. Try validating the key again shortly.',
      );
    }

    const saved = await this.repository.save({
      apiKeyFingerprint: fingerprintAiCredential(apiKey),
      configuredByUserId: input.configuredByUserId,
      embeddingDimensions: models.embeddingDimensions,
      embeddingModel: models.embeddingModel,
      encryptedApiKey: this.cipher.encrypt({
        apiKey,
        provider: input.provider,
        workspaceId: input.workspaceId,
      }),
      encryptionKeyVersion: 1,
      generationModel: models.generationModel,
      provider: input.provider,
      validatedAt: new Date(),
      workspaceId: input.workspaceId,
    });
    return this.toSummary(saved);
  }

  remove(workspaceId: string): Promise<boolean> {
    return this.repository.delete(workspaceId);
  }

  async resolve(workspaceId: string): Promise<ResolvedAiProvider> {
    const stored = await this.repository.find(workspaceId);
    if (!stored) throw new AiProviderNotConfiguredError();
    const expected = getAiProviderModelConfiguration(stored.provider);
    if (
      stored.embeddingModel !== expected.embeddingModel ||
      stored.embeddingDimensions !== expected.embeddingDimensions ||
      stored.generationModel !== expected.generationModel
    ) {
      throw new ServiceUnavailableException(
        'The workspace AI provider configuration must be revalidated.',
      );
    }
    const apiKey = this.cipher.decrypt({
      encryptedApiKey: stored.encryptedApiKey,
      provider: stored.provider,
      workspaceId,
    });
    return {
      client: this.clients.create({ apiKey, provider: stored.provider }),
      embeddingRevision: stored.embeddingRevision,
      provider: stored.provider,
    };
  }

  private toSummary(
    configuration: StoredAiConfiguration,
  ): AiConfigurationSummary {
    return {
      configured: true,
      embeddingDimensions: configuration.embeddingDimensions,
      embeddingModel: configuration.embeddingModel,
      generationModel: configuration.generationModel,
      provider: configuration.provider,
      updatedAt: configuration.updatedAt,
      validatedAt: configuration.validatedAt,
    };
  }
}

function isCredentialRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false;
  }
  const status = error.status;
  return (
    typeof status === 'number' && [400, 401, 403, 404, 429].includes(status)
  );
}
