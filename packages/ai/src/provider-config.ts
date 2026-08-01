export const AI_PROVIDER_VALUES = ['openai', 'google-gemini'] as const;

export type AiProvider = (typeof AI_PROVIDER_VALUES)[number];

export interface AiProviderModelConfiguration {
  embeddingDimensions: 1536;
  embeddingModel: string;
  generationModel: string;
  provider: AiProvider;
}

export const AI_PROVIDER_MODEL_CONFIGURATIONS = {
  'google-gemini': {
    embeddingDimensions: 1536,
    embeddingModel: 'gemini-embedding-2',
    generationModel: 'gemini-3.6-flash',
    provider: 'google-gemini',
  },
  openai: {
    embeddingDimensions: 1536,
    embeddingModel: 'text-embedding-3-small',
    generationModel: 'gpt-5.6-luna',
    provider: 'openai',
  },
} as const satisfies Record<AiProvider, AiProviderModelConfiguration>;

export function isAiProvider(value: unknown): value is AiProvider {
  return (
    typeof value === 'string' &&
    (AI_PROVIDER_VALUES as readonly string[]).includes(value)
  );
}

export function getAiProviderModelConfiguration(
  provider: AiProvider,
): AiProviderModelConfiguration {
  return AI_PROVIDER_MODEL_CONFIGURATIONS[provider];
}
