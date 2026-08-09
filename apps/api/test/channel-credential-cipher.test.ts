import { createCipheriv } from 'node:crypto';

import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { ChannelCredentialCipher } from '../src/support/telegram/channel-credential-cipher';

const encryptionKey = Buffer.alloc(32, 7);
const workspaceContext = {
  kind: 'telegram' as const,
  workspaceId: 'workspace-1',
};

describe('ChannelCredentialCipher', () => {
  const cipher = new ChannelCredentialCipher(
    new ConfigService({
      CHANNEL_CREDENTIALS_ENCRYPTION_KEY: encryptionKey.toString('base64'),
    }),
  );

  it('binds new ciphertext to the workspace and channel context', () => {
    const encrypted = cipher.encrypt('secret-token', workspaceContext);

    expect(encrypted.startsWith('v2.')).toBe(true);
    expect(cipher.decrypt(encrypted, workspaceContext)).toBe('secret-token');
    expect(() =>
      cipher.decrypt(encrypted, {
        kind: 'telegram',
        workspaceId: 'workspace-2',
      }),
    ).toThrow(ServiceUnavailableException);
    expect(() =>
      cipher.decrypt(encrypted, {
        kind: 'gmail',
        workspaceId: 'workspace-1',
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it('keeps existing v1 credentials readable during migration', () => {
    const iv = Buffer.alloc(12, 3);
    const legacyCipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encrypted = Buffer.concat([
      legacyCipher.update('legacy-token', 'utf8'),
      legacyCipher.final(),
    ]);
    const payload = [
      'v1',
      iv.toString('base64url'),
      legacyCipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');

    expect(cipher.decrypt(payload, workspaceContext)).toBe('legacy-token');
  });

  it('rejects non-canonical base64 root keys', () => {
    const invalid = new ChannelCredentialCipher(
      new ConfigService({
        CHANNEL_CREDENTIALS_ENCRYPTION_KEY: `${encryptionKey.toString('base64')}!ignored`,
      }),
    );

    expect(() => invalid.encrypt('secret-token', workspaceContext)).toThrow(
      ServiceUnavailableException,
    );
  });
});
