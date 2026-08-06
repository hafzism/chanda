import { Injectable } from '@nestjs/common';
import type { AiProvider } from '@suppline/ai';

import { AiConfigurationService } from '../ai/ai-configuration.service';

export interface QueryEmbedding {
  dimensions: number;
  model: string;
  provider: AiProvider;
  vector: number[];
}

export interface QueryEmbeddingProvider {
  embedQuery(workspaceId: string, query: string): Promise<QueryEmbedding>;
}

@Injectable()
export class WorkspaceQueryEmbeddingService implements QueryEmbeddingProvider {
  constructor(private readonly configurations: AiConfigurationService) {}

  async embedQuery(
    workspaceId: string,
    query: string,
  ): Promise<QueryEmbedding> {
    const configured = await this.configurations.resolve(workspaceId);
    return {
      dimensions: configured.client.configuration.embeddingDimensions,
      model: configured.client.configuration.embeddingModel,
      provider: configured.provider,
      vector: await configured.client.embedQuery(query),
    };
  }
}
