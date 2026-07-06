import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChannelCredentialCipher {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const [version, encodedIv, encodedTag, encodedValue] = payload.split('.');
    if (version !== 'v1' || !encodedIv || !encodedTag || !encodedValue) {
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

  private key(): Buffer {
    const encoded = this.config.get<string>(
      'CHANNEL_CREDENTIALS_ENCRYPTION_KEY',
    );
    const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'Channel credential encryption is not configured. Add a base64-encoded 32-byte CHANNEL_CREDENTIALS_ENCRYPTION_KEY.',
      );
    }
    return key;
  }
}
