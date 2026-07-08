export interface WhatsAppPhoneIdentity {
  displayPhoneNumber: string;
  id: string;
  verifiedName: string;
}

export interface WhatsAppConnectionSummary {
  displayPhoneNumber: string | null;
  id: string | null;
  lastInboundAt: Date | null;
  name: string;
  phoneNumberId: string | null;
  status: 'active' | 'disconnected' | 'error';
  verifiedName: string | null;
  verifyToken?: string;
  webhookUrl: string | null;
  webhookVerifiedAt: string | null;
}

export interface WhatsAppInboundMessage {
  body: string;
  displayName: string;
  externalMessageId: string;
  occurredAt: Date;
  phoneNumber: string;
}

export interface WhatsAppApi {
  getPhone(
    accessToken: string,
    phoneNumberId: string,
  ): Promise<WhatsAppPhoneIdentity>;
  sendText(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    body: string,
  ): Promise<{ messageId: string }>;
}

export interface WhatsAppRepository {
  disconnect(workspaceId: string): Promise<boolean>;
  findConnection(
    workspaceId: string,
  ): Promise<WhatsAppConnectionSummary | null>;
  findDeliveryContext(
    workspaceId: string,
    conversationId: string,
    draftId?: string,
  ): Promise<
    | { channel: 'other' }
    | {
        channel: 'whatsapp';
        encryptedCredentials: string | null;
        lastInboundAt: Date;
        phoneNumber: string;
        phoneNumberId: string;
      }
    | null
  >;
  findWebhookCredential(connectionId: string): Promise<{
    encryptedCredentials: string;
    phoneNumberId: string;
    webhookSecretHash: string;
  } | null>;
  ingest(
    connectionId: string,
    input: WhatsAppInboundMessage,
  ): Promise<{
    conversationId: string;
    messageId: string;
    ticketNumber: number;
  } | null>;
  markDeliveryStatus(
    connectionId: string,
    externalMessageId: string,
    status: string,
    occurredAt: Date,
    error: string | null,
  ): Promise<void>;
  markWebhookVerified(connectionId: string): Promise<void>;
  saveConnection(input: {
    connectionId: string;
    encryptedCredentials: string;
    phone: WhatsAppPhoneIdentity;
    webhookSecretHash: string;
    webhookUrl: string;
    workspaceId: string;
  }): Promise<WhatsAppConnectionSummary>;
}
