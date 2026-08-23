export interface WidgetMessage {
  authorKind: 'customer' | 'agent' | 'ai' | 'system';
  body: string;
  direction: 'inbound' | 'outbound';
  id: string;
  occurredAt: string;
}

export interface WidgetSession {
  conversationToken: string;
  hasConversation: boolean;
  threadId: string;
  visitorId: string;
}

interface StoredSession {
  conversationToken?: unknown;
  hasConversation?: unknown;
  threadId?: unknown;
  visitorId?: unknown;
}

export interface WidgetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function sessionStorageKey(publicKey: string): string {
  return `chanda:widget:${publicKey}:session`;
}

function legacySessionStorageKey(publicKey: string): string {
  return `suppline:widget:${publicKey}:session`;
}

export function createConversationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function loadWidgetSession(
  publicKey: string,
  storage: WidgetStorage,
): WidgetSession {
  try {
    const current = storage.getItem(sessionStorageKey(publicKey));
    const saved = JSON.parse(
      current ?? storage.getItem(legacySessionStorageKey(publicKey)) ?? 'null',
    ) as StoredSession | null;
    if (
      saved &&
      typeof saved.conversationToken === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(saved.conversationToken) &&
      typeof saved.threadId === 'string' &&
      typeof saved.visitorId === 'string'
    ) {
      const session = {
        conversationToken: saved.conversationToken,
        hasConversation: saved.hasConversation === true,
        threadId: saved.threadId,
        visitorId: saved.visitorId,
      };
      if (!current) saveWidgetSession(publicKey, storage, session);
      return session;
    }
  } catch {
    // Unavailable or malformed browser storage falls through to a new session.
  }
  const session: WidgetSession = {
    conversationToken: createConversationToken(),
    hasConversation: false,
    threadId: crypto.randomUUID(),
    visitorId: crypto.randomUUID(),
  };
  saveWidgetSession(publicKey, storage, session);
  return session;
}

export function saveWidgetSession(
  publicKey: string,
  storage: WidgetStorage,
  session: WidgetSession,
): void {
  try {
    storage.setItem(sessionStorageKey(publicKey), JSON.stringify(session));
  } catch {
    // The in-memory session still works when storage is blocked or full.
  }
}

export class WidgetApiClient {
  constructor(
    private readonly apiOrigin: string,
    private readonly publicKey: string,
    private readonly request: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}

  async sendMessage(
    session: WidgetSession,
    body: string,
    messageId: string,
  ): Promise<void> {
    await this.fetchJson(
      `/v1/public/widget/${encodeURIComponent(this.publicKey)}/messages`,
      {
        body: JSON.stringify({
          body,
          conversationToken: session.conversationToken,
          messageId,
          threadId: session.threadId,
          visitorId: session.visitorId,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );
  }

  async readMessages(session: WidgetSession): Promise<WidgetMessage[]> {
    const result = await this.fetchJson<{ messages: WidgetMessage[] }>(
      `/v1/public/widget/${encodeURIComponent(this.publicKey)}/conversations/${encodeURIComponent(session.threadId)}/messages`,
      {
        headers: {
          Authorization: `Bearer ${session.conversationToken}`,
        },
      },
    );
    return result.messages;
  }

  private async fetchJson<T = unknown>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await this.request(`${this.apiOrigin}${path}`, init);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      const message = Array.isArray(payload?.message)
        ? payload.message[0]
        : payload?.message;
      throw new Error(message ?? 'Support is temporarily unavailable.');
    }
    return response.json() as Promise<T>;
  }
}
