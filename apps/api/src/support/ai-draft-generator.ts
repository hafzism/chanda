import { Injectable } from '@nestjs/common';

import { AiConfigurationService } from '../ai/ai-configuration.service';
import type { AiDraftCitation, AiDraftContext } from './support.types';

export const AI_DRAFT_PROMPT_VERSION = 'support-draft-v2';

export interface AiDraftGenerator {
  generate(input: {
    context: AiDraftContext;
    evidence: AiDraftCitation[];
    workspaceId: string;
  }): Promise<{ body: string; model: string; provider: string }>;
}

@Injectable()
export class WorkspaceAiDraftGenerator implements AiDraftGenerator {
  constructor(private readonly configurations: AiConfigurationService) {}

  async generate(input: {
    context: AiDraftContext;
    evidence: AiDraftCitation[];
    workspaceId: string;
  }): Promise<{ body: string; model: string; provider: string }> {
    const configured = await this.configurations.resolve(input.workspaceId);
    const body = await configured.client.generateDraft({
      evidence: input.evidence.map(({ content, heading, title }) => ({
        content,
        heading,
        title,
      })),
      transcript: input.context.transcript,
    });
    return {
      body,
      model: configured.client.configuration.generationModel,
      provider: configured.provider,
    };
  }
}
