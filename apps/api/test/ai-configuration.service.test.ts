import {
  AI_PROVIDER_MODEL_CONFIGURATIONS,
  type AiProviderClient,
} from '@suppline/ai';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AiConfigurationService,
  AiProviderNotConfiguredError,
} from '../src/ai/ai-configuration.service';
import type { AiCredentialCipherService } from '../src/ai/ai-credential-cipher.service';
import type { AiProviderClientFactory } from '../src/ai/ai-provider-client.factory';
import type {
  AiConfigurationRepository,
  StoredAiConfiguration,
} from '../src/ai/ai-configuration.types';

const now = new Date('2026-08-19T00:00:00.000Z');
const stored: StoredAiConfiguration = {
  apiKeyFingerprint: 'a'.repeat(64),
  configuredByUserId: 'user-1',
  createdAt: now,
  embeddingDimensions: 1536,
  embeddingModel: 'text-embedding-3-small',
  embeddingRevision: 1,
  encryptedApiKey: 'encrypted',
  encryptionKeyVersion: 1,
  generationModel: 'gpt-5.6-luna',
  provider: 'openai',
  updatedAt: now,
  validatedAt: now,
  workspaceId: 'workspace-1',
};

describe('AiConfigurationService', () => {
  const find = vi.fn<AiConfigurationRepository['find']>();
  const save = vi.fn<AiConfigurationRepository['save']>();
  const remove = vi.fn<AiConfigurationRepository['delete']>();
  const encrypt = vi.fn<AiCredentialCipherService['encrypt']>();
  const decrypt = vi.fn<AiCredentialCipherService['decrypt']>();
  const validateConnection = vi.fn<AiProviderClient['validateConnection']>();
  const client: AiProviderClient = {
    configuration: AI_PROVIDER_MODEL_CONFIGURATIONS.openai,
    embedDocuments: vi.fn(),
    embedQuery: vi.fn(),
    generateDraft: vi.fn(),
    validateConnection,
  };
  const create = vi.fn<AiProviderClientFactory['create']>();
  let service: AiConfigurationService;

  beforeEach(() => {
    vi.clearAllMocks();
    find.mockResolvedValue(null);
    save.mockResolvedValue(stored);
    remove.mockResolvedValue(true);
    encrypt.mockReturnValue('encrypted');
    decrypt.mockReturnValue('openai-secret');
    validateConnection.mockResolvedValue(undefined);
    create.mockReturnValue(client);
    service = new AiConfigurationService(
      { delete: remove, find, save },
      { decrypt, encrypt } as unknown as AiCredentialCipherService,
      { create },
    );
  });

  it('returns a secret-free unconfigured summary', async () => {
    await expect(service.summary('workspace-1')).resolves.toEqual({
      configured: false,
      embeddingDimensions: null,
      embeddingModel: null,
      generationModel: null,
      provider: null,
      updatedAt: null,
      validatedAt: null,
    });
  });

  it('validates before encrypting and persists only server-selected models', async () => {
    const summary = await service.configure({
      apiKey: '  openai-secret  ',
      configuredByUserId: 'user-1',
      provider: 'openai',
      workspaceId: 'workspace-1',
    });

    expect(validateConnection).toHaveBeenCalledOnce();
    expect(encrypt).toHaveBeenCalledWith({
      apiKey: 'openai-secret',
      provider: 'openai',
      workspaceId: 'workspace-1',
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddingDimensions: 1536,
        embeddingModel: 'text-embedding-3-small',
        encryptedApiKey: 'encrypted',
        generationModel: 'gpt-5.6-luna',
      }),
    );
    expect(summary).not.toHaveProperty('encryptedApiKey');
    expect(summary).not.toHaveProperty('apiKeyFingerprint');
  });

  it('does not store a rejected credential', async () => {
    validateConnection.mockRejectedValue({ status: 401 });

    await expect(
      service.configure({
        apiKey: 'openai-secret',
        configuredByUserId: 'user-1',
        provider: 'openai',
        workspaceId: 'workspace-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(encrypt).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not misreport a provider outage as an invalid credential', async () => {
    validateConnection.mockRejectedValue(new Error('network unavailable'));

    await expect(
      service.configure({
        apiKey: 'openai-secret',
        configuredByUserId: 'user-1',
        provider: 'openai',
        workspaceId: 'workspace-1',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(encrypt).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('fails closed for missing or stale model configuration', async () => {
    await expect(service.resolve('workspace-1')).rejects.toBeInstanceOf(
      AiProviderNotConfiguredError,
    );
    find.mockResolvedValue({ ...stored, generationModel: 'unapproved-model' });
    await expect(service.resolve('workspace-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('decrypts only while resolving a server-side provider client', async () => {
    find.mockResolvedValue(stored);

    const resolved = await service.resolve('workspace-1');

    expect(decrypt).toHaveBeenCalledWith({
      encryptedApiKey: 'encrypted',
      provider: 'openai',
      workspaceId: 'workspace-1',
    });
    expect(create).toHaveBeenCalledWith({
      apiKey: 'openai-secret',
      provider: 'openai',
    });
    expect(resolved.embeddingRevision).toBe(1);
  });
});
