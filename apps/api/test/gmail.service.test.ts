import { createHash } from 'node:crypto';

/* eslint-disable @typescript-eslint/unbound-method -- interface mocks are intentionally asserted as detached Vitest functions */

import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createReplyMime,
  GmailService,
  parseGmailMessage,
} from '../src/support/gmail/gmail.service';
import type {
  GmailApi,
  GmailRawMessage,
  GmailRepository,
} from '../src/support/gmail/gmail.types';
import { ChannelCredentialCipher } from '../src/support/telegram/channel-credential-cipher';

const rawMessage = (input: {
  body: string;
  from?: string;
  id: string;
  occurredAt: number;
}): GmailRawMessage => ({
  historyId: 'history-message',
  id: input.id,
  internalDate: String(input.occurredAt),
  payload: {
    body: { data: Buffer.from(input.body).toString('base64url') },
    headers: [
      { name: 'From', value: input.from ?? 'Amina <amina@example.com>' },
      { name: 'Message-ID', value: `<${input.id}@mail.example>` },
      { name: 'Subject', value: 'Order status' },
    ],
    mimeType: 'text/plain',
  },
  threadId: 'thread-1',
});

describe('GmailService', () => {
  let api: GmailApi;
  let cipher: ChannelCredentialCipher;
  let repository: GmailRepository;
  let service: GmailService;

  beforeEach(() => {
    cipher = new ChannelCredentialCipher(
      new ConfigService({
        CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          'base64',
        ),
      }),
    );
    api = {
      authorizationUrl: vi.fn(
        (state) => `https://accounts.example/?state=${state}`,
      ),
      exchangeCode: vi.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
      getMessage: vi.fn(),
      getProfile: vi.fn().mockResolvedValue({
        emailAddress: 'support@example.com',
        historyId: 'history-new',
      }),
      listHistory: vi.fn(),
      listInitialMessageIds: vi.fn().mockResolvedValue([]),
      refreshAccessToken: vi.fn().mockResolvedValue('access'),
      revoke: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockResolvedValue({
        id: 'sent-1',
        threadId: 'thread-1',
      }),
    };
    repository = {
      consumeOAuthState: vi.fn(),
      createOAuthState: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      findConnection: vi.fn().mockResolvedValue(null),
      findCredential: vi.fn().mockResolvedValue(null),
      findDeliveryContext: vi.fn(),
      ingest: vi.fn(),
      markSyncFailure: vi.fn().mockResolvedValue(undefined),
      saveConnection: vi.fn(),
      saveSyncSuccess: vi.fn().mockResolvedValue(undefined),
    };
    service = new GmailService(
      repository,
      api,
      cipher,
      new ConfigService({
        GMAIL_OAUTH_REDIRECT_URI:
          'https://api.example/v1/public/gmail/oauth/callback',
        GOOGLE_GMAIL_CLIENT_ID: 'client',
        GOOGLE_GMAIL_CLIENT_SECRET: 'secret',
      }),
    );
  });

  it('stores only a hash of the one-time OAuth state', async () => {
    const result = await service.beginOAuth('workspace-1', 'user-1');
    const state = new URL(result.authorizationUrl).searchParams.get('state');
    const saved = vi.mocked(repository.createOAuthState).mock.calls[0]?.[0];

    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(saved?.stateHash).toBe(
      createHash('sha256')
        .update(state ?? '')
        .digest('hex'),
    );
    expect(saved?.stateHash).not.toBe(state);
  });

  it('imports initial messages oldest-first and advances the history cursor', async () => {
    vi.mocked(repository.findCredential).mockResolvedValue({
      connectionId: 'connection-1',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ refreshToken: 'refresh' }),
      ),
      settings: {
        emailAddress: 'support@example.com',
        historyId: 'history-old',
      },
    });
    vi.mocked(api.listInitialMessageIds).mockResolvedValue(['new', 'old']);
    vi.mocked(api.getMessage)
      .mockResolvedValueOnce(
        rawMessage({ body: 'New message', id: 'new', occurredAt: 2_000 }),
      )
      .mockResolvedValueOnce(
        rawMessage({ body: 'Old message', id: 'old', occurredAt: 1_000 }),
      );

    await expect(service.sync('workspace-1')).resolves.toMatchObject({
      imported: 2,
    });
    expect(
      vi
        .mocked(repository.ingest)
        .mock.calls.map((call) => call[1].externalMessageId),
    ).toEqual(['old', 'new']);
    expect(repository.saveSyncSuccess).toHaveBeenCalledWith(
      'workspace-1',
      'history-new',
      expect.any(Date),
    );
  });

  it('falls back to a bounded full sync when Google expires the cursor', async () => {
    vi.mocked(repository.findCredential).mockResolvedValue({
      connectionId: 'connection-1',
      encryptedCredentials: cipher.encrypt(
        JSON.stringify({ refreshToken: 'refresh' }),
      ),
      settings: {
        emailAddress: 'support@example.com',
        historyId: 'history-old',
        lastSyncAt: '2026-07-14T00:00:00.000Z',
      },
    });
    vi.mocked(api.listHistory).mockResolvedValue('expired');

    await service.sync('workspace-1');

    expect(api.listInitialMessageIds).toHaveBeenCalledWith('access');
    expect(repository.saveSyncSuccess).toHaveBeenCalledWith(
      'workspace-1',
      'history-new',
      expect.any(Date),
    );
  });
});

describe('Gmail message normalization', () => {
  it('normalizes inbound plain text and ignores messages sent by the mailbox', () => {
    expect(
      parseGmailMessage(
        rawMessage({
          body: '  Where is my order?  ',
          id: 'message-1',
          occurredAt: 1_000,
        }),
        'support@example.com',
      ),
    ).toMatchObject({
      body: 'Where is my order?',
      fromEmail: 'amina@example.com',
      fromName: 'Amina',
      subject: 'Order status',
    });
    expect(
      parseGmailMessage(
        rawMessage({
          body: 'Sent reply',
          from: 'Support <support@example.com>',
          id: 'message-2',
          occurredAt: 2_000,
        }),
        'support@example.com',
      ),
    ).toBeNull();
  });

  it('creates a threaded RFC-compatible plain-text reply', () => {
    const decoded = Buffer.from(
      createReplyMime({
        body: 'Your order shipped.',
        inReplyTo: '<message-1@mail.example>',
        subject: 'Order status',
        to: 'amina@example.com',
      }),
      'base64url',
    ).toString('utf8');

    expect(decoded).toContain('To: amina@example.com\r\n');
    expect(decoded).toContain('Subject: Re: Order status\r\n');
    expect(decoded).toContain('In-Reply-To: <message-1@mail.example>\r\n');
    expect(decoded).toContain('References: <message-1@mail.example>\r\n');
    expect(decoded.endsWith('\r\n\r\nYour order shipped.')).toBe(true);
  });
});
