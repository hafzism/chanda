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

export interface GmailChannel {
  emailAddress: string | null;
  id: string | null;
  lastInboundAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  name: string;
  oauthConfigured: boolean;
  redirectUri: string;
  status: 'active' | 'disconnected' | 'error';
}

export interface WhatsAppChannel {
  displayPhoneNumber: string | null;
  id: string | null;
  lastInboundAt: string | null;
  name: string;
  phoneNumberId: string | null;
  status: 'active' | 'disconnected' | 'error';
  verifiedName: string | null;
  verifyToken?: string;
  webhookUrl: string | null;
  webhookVerifiedAt: string | null;
}

export type MetaChannelKind = 'facebook' | 'instagram';

export interface MetaMessagingChannel {
  assetId: string | null;
  assetName: string | null;
  id: string | null;
  kind: MetaChannelKind;
  lastInboundAt: string | null;
  name: string;
  status: 'active' | 'disconnected' | 'error';
  username: string | null;
  verifyToken?: string;
  webhookUrl: string | null;
  webhookVerifiedAt: string | null;
}

export function getTelegramChannel(workspaceId: string) {
  return apiRequest<TelegramChannel>(
    `/workspaces/${workspaceId}/channels/telegram`,
    { cache: 'no-store' },
  );
}

export function connectTelegramChannel(workspaceId: string, botToken: string) {
  return apiRequest<TelegramChannel>(
    `/workspaces/${workspaceId}/channels/telegram`,
    { body: JSON.stringify({ botToken }), method: 'POST' },
  );
}

export function disconnectTelegramChannel(workspaceId: string) {
  return apiRequest<void>(`/workspaces/${workspaceId}/channels/telegram`, {
    method: 'DELETE',
  });
}

export function getGmailChannel(workspaceId: string) {
  return apiRequest<GmailChannel>(`/workspaces/${workspaceId}/channels/gmail`, {
    cache: 'no-store',
  });
}

export function beginGmailOAuth(workspaceId: string) {
  return apiRequest<{ authorizationUrl: string }>(
    `/workspaces/${workspaceId}/channels/gmail/oauth`,
    { method: 'POST' },
  );
}

export function syncGmailChannel(workspaceId: string) {
  return apiRequest<{ imported: number; syncedAt: string }>(
    `/workspaces/${workspaceId}/channels/gmail/sync`,
    { method: 'POST' },
  );
}

export function disconnectGmailChannel(workspaceId: string) {
  return apiRequest<void>(`/workspaces/${workspaceId}/channels/gmail`, {
    method: 'DELETE',
  });
}

export function getWhatsAppChannel(workspaceId: string) {
  return apiRequest<WhatsAppChannel>(
    `/workspaces/${workspaceId}/channels/whatsapp`,
    { cache: 'no-store' },
  );
}

export function connectWhatsAppChannel(
  workspaceId: string,
  input: { accessToken: string; appSecret: string; phoneNumberId: string },
) {
  return apiRequest<WhatsAppChannel>(
    `/workspaces/${workspaceId}/channels/whatsapp`,
    { body: JSON.stringify(input), method: 'POST' },
  );
}

export function disconnectWhatsAppChannel(workspaceId: string) {
  return apiRequest<void>(`/workspaces/${workspaceId}/channels/whatsapp`, {
    method: 'DELETE',
  });
}

export function getMetaMessagingChannel(
  workspaceId: string,
  kind: MetaChannelKind,
) {
  return apiRequest<MetaMessagingChannel>(
    `/workspaces/${workspaceId}/channels/meta/${kind}`,
    { cache: 'no-store' },
  );
}

export function connectMetaMessagingChannel(
  workspaceId: string,
  kind: MetaChannelKind,
  input: { assetId: string; appSecret: string; pageAccessToken: string },
) {
  return apiRequest<MetaMessagingChannel>(
    `/workspaces/${workspaceId}/channels/meta/${kind}`,
    { body: JSON.stringify(input), method: 'POST' },
  );
}

export function disconnectMetaMessagingChannel(
  workspaceId: string,
  kind: MetaChannelKind,
) {
  return apiRequest<void>(`/workspaces/${workspaceId}/channels/meta/${kind}`, {
    method: 'DELETE',
  });
}

export function getWebChannel(workspaceId: string) {
  return apiRequest<WebChannel>(`/workspaces/${workspaceId}/channels/web`, {
    cache: 'no-store',
  });
}

export function updateWebChannelOrigins(
  workspaceId: string,
  origins: string[],
) {
  return apiRequest<WebChannel>(
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
import { apiRequest } from './api-client';
