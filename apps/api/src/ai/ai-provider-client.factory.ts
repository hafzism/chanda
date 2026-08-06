import {
  createAiProviderClient,
  type AiProvider,
  type AiProviderClient,
} from '@suppline/ai';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiProviderClientFactory {
  create(input: { apiKey: string; provider: AiProvider }): AiProviderClient {
    return createAiProviderClient(input);
  }
}
