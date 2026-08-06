import {
  decryptAiCredential,
  encryptAiCredential,
  parseAiCredentialEncryptionKey,
  type AiProvider,
} from '@suppline/ai';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiCredentialCipherService {
  constructor(private readonly config: ConfigService) {}

  encrypt(input: {
    apiKey: string;
    provider: AiProvider;
    workspaceId: string;
  }): string {
    try {
      return encryptAiCredential({
        ...input,
        encryptionKey: this.encryptionKey(),
      });
    } catch {
      throw this.unavailable();
    }
  }

  decrypt(input: {
    encryptedApiKey: string;
    provider: AiProvider;
    workspaceId: string;
  }): string {
    try {
      return decryptAiCredential({
        ...input,
        encryptionKey: this.encryptionKey(),
      });
    } catch {
      throw this.unavailable();
    }
  }

  private encryptionKey(): Buffer {
    const encoded =
      this.config.get<string>('AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY') ?? '';
    return parseAiCredentialEncryptionKey(encoded.trim());
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'AI provider credential encryption is unavailable.',
    );
  }
}
