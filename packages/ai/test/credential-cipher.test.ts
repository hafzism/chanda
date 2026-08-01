import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  AiCredentialCipherError,
  decryptAiCredential,
  encryptAiCredential,
  fingerprintAiCredential,
  parseAiCredentialEncryptionKey,
} from '../src/credential-cipher';

describe('AI provider credential encryption', () => {
  it('round-trips a credential only in its workspace and provider context', () => {
    const encryptionKey = randomBytes(32);
    const encryptedApiKey = encryptAiCredential({
      apiKey: 'provider-secret',
      encryptionKey,
      provider: 'openai',
      workspaceId: 'workspace-1',
    });

    expect(
      decryptAiCredential({
        encryptedApiKey,
        encryptionKey,
        provider: 'openai',
        workspaceId: 'workspace-1',
      }),
    ).toBe('provider-secret');
    expect(() =>
      decryptAiCredential({
        encryptedApiKey,
        encryptionKey,
        provider: 'openai',
        workspaceId: 'workspace-2',
      }),
    ).toThrow(AiCredentialCipherError);
  });

  it('rejects malformed encryption keys and fingerprints without disclosure', () => {
    expect(() => parseAiCredentialEncryptionKey('not-a-key')).toThrow(
      AiCredentialCipherError,
    );
    expect(() =>
      parseAiCredentialEncryptionKey(
        `${Buffer.alloc(32, 1).toString('base64')}!ignored`,
      ),
    ).toThrow(AiCredentialCipherError);
    expect(fingerprintAiCredential('provider-secret')).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(fingerprintAiCredential('provider-secret')).not.toContain(
      'provider-secret',
    );
  });
});
