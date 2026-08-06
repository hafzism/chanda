import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AiProviderNotConfiguredError } from '../ai/ai-configuration.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { decideAiDraft } from './ai-draft-decision';
import {
  AI_DRAFT_PROMPT_VERSION,
  type AiDraftGenerator,
} from './ai-draft-generator';
import { SUPPORT_REPOSITORY } from './support.service';
import type {
  AiDraft,
  AiDraftCitation,
  SupportRepository,
} from './support.types';

export const AI_DRAFT_GENERATOR = Symbol('AI_DRAFT_GENERATOR');

@Injectable()
export class AiDraftService {
  constructor(
    @Inject(SUPPORT_REPOSITORY)
    private readonly repository: SupportRepository,
    @Inject(AI_DRAFT_GENERATOR)
    private readonly generator: AiDraftGenerator,
    private readonly knowledge: KnowledgeService,
  ) {}

  async generate(
    workspaceId: string,
    conversationId: string,
    userId: string,
  ): Promise<AiDraft> {
    const context = await this.repository.getAiDraftContext(
      workspaceId,
      conversationId,
    );
    if (!context) throw new NotFoundException('Conversation not found.');

    const retrieval = await this.knowledge.search(workspaceId, {
      maxResults: 5,
      query: context.inputMessageBody,
    });
    const citations: AiDraftCitation[] = retrieval.results.map((result) => ({
      characterEnd: result.metadata.characterEnd,
      characterStart: result.metadata.characterStart,
      content: result.metadata.content,
      documentId: result.metadata.documentId,
      heading: result.metadata.heading,
      keywordRank: result.keywordRank,
      semanticRank: result.semanticRank,
      title: result.metadata.title,
      versionId: result.metadata.versionId,
    }));
    const decision = decideAiDraft({
      citations,
      query: context.inputMessageBody,
      retrievalMode: retrieval.mode,
    });

    let body =
      'Thanks for contacting us. I’m passing this to a support specialist who can verify the details and follow up with you.';
    let model = 'deterministic-handoff';
    let promptVersion = 'safe-handoff-v1';
    let provider = 'system';
    if (citations.length > 0) {
      try {
        const generated = await this.generator.generate({
          context,
          evidence: citations,
          workspaceId,
        });
        body = generated.body;
        model = generated.model;
        promptVersion = AI_DRAFT_PROMPT_VERSION;
        provider = generated.provider;
      } catch (error: unknown) {
        if (error instanceof AiProviderNotConfiguredError) {
          throw new ConflictException(
            'Configure an AI provider before generating drafts.',
          );
        }
        throw new ServiceUnavailableException(
          'The AI draft service is temporarily unavailable.',
        );
      }
    }

    return this.repository.saveAiDraft({
      ...decision,
      body,
      citations,
      conversationId,
      inputMessageId: context.inputMessageId,
      model,
      promptVersion,
      provider,
      requestedByUserId: userId,
      retrievalMode: retrieval.mode,
      ticketId: context.ticketId,
      workspaceId,
    });
  }
}
