import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  configureAiProvider,
  readAiProvider,
  removeAiProvider,
} from '../lib/ai-provider';

describe('workspace AI provider operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads, configures, and removes a write-only workspace credential', async () => {
    const configured = {
      configured: true,
      embeddingDimensions: 1536,
      embeddingModel: 'text-embedding-3-small',
      generationModel: 'gpt-5.6-luna',
      provider: 'openai',
      updatedAt: '2026-08-19T00:00:00.000Z',
      validatedAt: '2026-08-19T00:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...configured, configured: false }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(configured), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await readAiProvider('workspace-1');
    await configureAiProvider('workspace-1', {
      apiKey: 'sk-test-value-not-real',
      provider: 'openai',
    });
    await removeAiProvider('workspace-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/workspaces/workspace-1/ai-provider',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/workspaces/workspace-1/ai-provider',
      expect.objectContaining({
        body: JSON.stringify({
          apiKey: 'sk-test-value-not-real',
          provider: 'openai',
        }),
        method: 'PUT',
      }),
    );
    const configureInit = fetchMock.mock.calls[1]?.[1] as
      RequestInit | undefined;
    expect(configureInit?.headers).toMatchObject({
      'Content-Type': 'application/json',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/workspaces/workspace-1/ai-provider',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('surfaces validated API error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: ['API key is invalid.'] }), {
          status: 400,
        }),
      ),
    );

    await expect(
      configureAiProvider('workspace-1', {
        apiKey: 'sk-test-value-not-real',
        provider: 'openai',
      }),
    ).rejects.toThrow('API key is invalid.');
  });
});
