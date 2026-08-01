import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const CIPHER_VERSION = 'v1';
const IV_BYTES = 12;

export class AiCredentialCipherError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AiCredentialCipherError';
  }
}

export function parseAiCredentialEncryptionKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encodedKey) {
    throw new AiCredentialCipherError(
      'AI provider credential encryption requires a base64-encoded 32-byte key.',
    );
  }
  return key;
}

export function encryptAiCredential(input: {
  apiKey: string;
  encryptionKey: Buffer;
  provider: string;
  workspaceId: string;
}): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', input.encryptionKey, iv);
  cipher.setAAD(credentialContext(input.workspaceId, input.provider));
  const encrypted = Buffer.concat([
    cipher.update(input.apiKey, 'utf8'),
    cipher.final(),
  ]);
  return [
    CIPHER_VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptAiCredential(input: {
  encryptedApiKey: string;
  encryptionKey: Buffer;
  provider: string;
  workspaceId: string;
}): string {
  const [version, encodedIv, encodedTag, encodedValue] =
    input.encryptedApiKey.split('.');
  if (
    version !== CIPHER_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedValue
  ) {
    throw new AiCredentialCipherError(
      'The stored AI provider credential has an unsupported format.',
    );
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      input.encryptionKey,
      Buffer.from(encodedIv, 'base64url'),
    );
    decipher.setAAD(credentialContext(input.workspaceId, input.provider));
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error: unknown) {
    throw new AiCredentialCipherError(
      'The stored AI provider credential cannot be decrypted.',
      { cause: error },
    );
  }
}

export function fingerprintAiCredential(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

function credentialContext(workspaceId: string, provider: string): Buffer {
  return Buffer.from(
    `chanda:workspace-ai-provider:${workspaceId}:${provider}`,
    'utf8',
  );
}
