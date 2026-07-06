export interface WebChannel {
  allowedOrigins: string[];
  id: string;
  lastInboundAt: string | null;
  name: string;
  publicKey: string;
  status: 'active' | 'disconnected' | 'error';
}

export interface TelegramChannel {
  botFirstName: string | null;
  botUsername: string | null;
  id: string | null;
  lastInboundAt: string | null;
  name: string;
  status: 'active' | 'disconnected' | 'error';
  webhookUrl: string | null;
}

async function channelRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new Error(message ?? 'The channel request could not be completed.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getTelegramChannel(workspaceId: string) {
  return channelRequest<TelegramChannel>(
    `/workspaces/${workspaceId}/channels/telegram`,
    { cache: 'no-store' },
  );
}

export function connectTelegramChannel(workspaceId: string, botToken: string) {
  return channelRequest<TelegramChannel>(
    `/workspaces/${workspaceId}/channels/telegram`,
    { body: JSON.stringify({ botToken }), method: 'POST' },
  );
}

export function disconnectTelegramChannel(workspaceId: string) {
  return channelRequest<void>(`/workspaces/${workspaceId}/channels/telegram`, {
    method: 'DELETE',
  });
}

export function getWebChannel(workspaceId: string) {
  return channelRequest<WebChannel>(`/workspaces/${workspaceId}/channels/web`, {
    cache: 'no-store',
  });
}

export function updateWebChannelOrigins(
  workspaceId: string,
  origins: string[],
) {
  return channelRequest<WebChannel>(
    `/workspaces/${workspaceId}/channels/web/origins`,
    { body: JSON.stringify({ origins }), method: 'PATCH' },
  );
}

export function normalizeWebsiteOrigin(value: string): string {
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('invalid origin');
    }
    return url.origin;
  } catch {
    throw new Error(
      'Enter only a website origin, such as https://support.example.com.',
    );
  }
}

export function createWidgetEmbedCode(input: {
  apiOrigin: string;
  publicKey: string;
  scriptOrigin: string;
}): string {
  return `<script src="${input.scriptOrigin}/widget.js" data-api-origin="${input.apiOrigin}" data-public-key="${input.publicKey}" defer></script>`;
}
