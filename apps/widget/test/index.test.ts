import { describe, expect, it, vi } from 'vitest';

import {
  createConversationToken,
  loadWidgetSession,
  sessionStorageKey,
  WidgetApiClient,
  type WidgetStorage,
} from '../src/widget-client';

describe('widget customer session', () => {
  it('creates and then restores one scoped capability', () => {
    const values = new Map<string, string>();
    const storage: WidgetStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };

    const first = loadWidgetSession('pub_123456789012345678901234', storage);
    const restored = loadWidgetSession('pub_123456789012345678901234', storage);

    expect(first.conversationToken).toHaveLength(43);
    expect(restored).toEqual(first);
    expect(values.has(sessionStorageKey('pub_123456789012345678901234'))).toBe(
      true,
    );
  });

  it('generates base64url capability tokens', () => {
    expect(createConversationToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('widget API client', () => {
  it('sends the same session capability and caller-owned message id', async () => {
    const request = vi.fn().mockResolvedValue(
      new Response('{}', {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    const client = new WidgetApiClient(
      'https://support.example.com',
      'pub_123456789012345678901234',
      request,
    );
    const session = {
      conversationToken: 'a'.repeat(43),
      hasConversation: false,
      threadId: 'thread-1',
      visitorId: 'visitor-1',
    };

    await client.sendMessage(session, 'Hello', 'message-1');

    const init = request.mock.calls[0]?.[1] as RequestInit;
    if (typeof init.body !== 'string') throw new Error('Expected JSON body.');
    expect(JSON.parse(init.body) as Record<string, unknown>).toMatchObject({
      conversationToken: 'a'.repeat(43),
      messageId: 'message-1',
      threadId: 'thread-1',
    });
  });
});
