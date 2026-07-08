export type MetaChannelKind = 'facebook' | 'instagram';

export interface MetaAssetIdentity {
  id: string;
  name: string;
  username: string | null;
}

export interface MetaConnectionSummary {
  assetId: string | null;
  assetName: string | null;
  id: string | null;
  kind: MetaChannelKind;
  lastInboundAt: Date | null;
  name: string;
  status: 'active' | 'disconnected' | 'error';
  username: string | null;
  verifyToken?: string;
  webhookUrl: string | null;
  webhookVerifiedAt: string | null;
}

export interface MetaInboundMessage {
  body: string;
  displayName: string;
  externalMessageId: string;
  occurredAt: Date;
  senderId: string;
}

export interface MetaMessagingApi {
  getAsset(
    kind: MetaChannelKind,
    pageAccessToken: string,
    assetId: string,
  ): Promise<MetaAssetIdentity>;
  sendText(
    kind: MetaChannelKind,
    pageAccessToken: string,
    assetId: string,
    recipientId: string,
    body: string,
  ): Promise<{ messageId: string }>;
}

export interface MetaMessagingRepository {
  disconnect(workspaceId: string, kind: MetaChannelKind): Promise<boolean>;
  findConnection(
    workspaceId: string,
    kind: MetaChannelKind,
  ): Promise<MetaConnectionSummary | null>;
  findDeliveryContext(
    workspaceId: string,
    conversationId: string,
    draftId?: string,
  ): Promise<
    | { channel: 'other' }
    | {
        assetId: string;
        channel: MetaChannelKind;
        encryptedCredentials: string | null;
        lastInboundAt: Date;
        recipientId: string;
      }
    | null
  >;
  findWebhookCredential(
    connectionId: string,
    kind: MetaChannelKind,
  ): Promise<{
    assetId: string;
    encryptedCredentials: string;
    webhookSecretHash: string;
  } | null>;
  ingest(
    connectionId: string,
    kind: MetaChannelKind,
    input: MetaInboundMessage,
  ): Promise<{
    conversationId: string;
    messageId: string;
    ticketNumber: number;
  } | null>;
  markDelivered(
    connectionId: string,
    externalMessageId: string,
    occurredAt: Date,
  ): Promise<void>;
  markWebhookVerified(
    connectionId: string,
    kind: MetaChannelKind,
  ): Promise<void>;
  saveConnection(input: {
    asset: MetaAssetIdentity;
    connectionId: string;
    encryptedCredentials: string;
    kind: MetaChannelKind;
    webhookSecretHash: string;
    webhookUrl: string;
    workspaceId: string;
  }): Promise<MetaConnectionSummary>;
}
