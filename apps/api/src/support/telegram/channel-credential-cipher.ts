import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChannelCredentialCipher {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string, context: ChannelCredentialContext): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(this.additionalAuthenticatedData(context));
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v2',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string, context: ChannelCredentialContext): string {
    const [version, encodedIv, encodedTag, encodedValue] = payload.split('.');
    if (
      !['v1', 'v2'].includes(version ?? '') ||
      !encodedIv ||
      !encodedTag ||
      !encodedValue
    ) {
      throw new ServiceUnavailableException(
        'Stored channel credentials cannot be read.',
      );
    }
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key(),
        Buffer.from(encodedIv, 'base64url'),
      );
      if (version === 'v2') {
        decipher.setAAD(this.additionalAuthenticatedData(context));
      }
      decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'Stored channel credentials cannot be decrypted.',
      );
    }
  }

  private additionalAuthenticatedData(
    context: ChannelCredentialContext,
  ): Buffer {
    return Buffer.from(
      `chanda:channel-credential:v2:${context.workspaceId}:${context.kind}`,
      'utf8',
    );
  }

  private key(): Buffer {
    const encoded = this.config.get<string>(
      'CHANNEL_CREDENTIALS_ENCRYPTION_KEY',
    );
    const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
    if (key.length !== 32 || !encoded || key.toString('base64') !== encoded) {
      throw new ServiceUnavailableException(
        'Channel credential encryption is not configured. Add a base64-encoded 32-byte CHANNEL_CREDENTIALS_ENCRYPTION_KEY.',
      );
    }
    return key;
  }
}

export interface ChannelCredentialContext {
  kind: 'facebook' | 'gmail' | 'instagram' | 'telegram' | 'whatsapp';
  workspaceId: string;
}
