import { AI_PROVIDER_VALUES, type AiProvider } from '@suppline/ai';
import { IsIn, IsString, Length } from 'class-validator';

export class ConfigureAiProviderDto {
  @IsIn(AI_PROVIDER_VALUES)
  provider!: AiProvider;

  @IsString()
  @Length(16, 2048)
  apiKey!: string;
}
