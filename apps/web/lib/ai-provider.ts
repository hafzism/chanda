import { apiRequest } from './api-client';

export const AI_PROVIDER_VALUES = ['openai', 'google-gemini'] as const;
export type AiProvider = (typeof AI_PROVIDER_VALUES)[number];

export interface AiProviderSummary {
  configured: boolean;
  embeddingDimensions: number | null;
  embeddingModel: string | null;
  generationModel: string | null;
  provider: AiProvider | null;
  updatedAt: string | null;
  validatedAt: string | null;
}

export function readAiProvider(
  workspaceId: string,
): Promise<AiProviderSummary> {
  return apiRequest(`/workspaces/${workspaceId}/ai-provider`, {
    cache: 'no-store',
  });
}

export function configureAiProvider(
  workspaceId: string,
  input: { apiKey: string; provider: AiProvider },
): Promise<AiProviderSummary> {
  return apiRequest(`/workspaces/${workspaceId}/ai-provider`, {
    body: JSON.stringify(input),
    method: 'PUT',
  });
}

export function removeAiProvider(workspaceId: string): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/ai-provider`, {
    method: 'DELETE',
  });
}
