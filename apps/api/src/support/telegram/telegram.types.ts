export interface TelegramBotIdentity {
  firstName: string;
  id: string;
  username: string;
}

export interface TelegramConnectionSummary {
  botFirstName: string | null;
  botUsername: string | null;
  id: string;
  lastInboundAt: Date | null;
  name: string;
  status: 'active' | 'disconnected' | 'error';
  webhookUrl: string | null;
}

export interface TelegramInboundMessage {
  body: string;
  chatId: string;
  displayName: string;
  externalMessageId: string;
  occurredAt: Date;
  telegramUserId: string;
  username: string | null;
}

export interface TelegramBotApi {
  deleteWebhook(token: string): Promise<void>;
  getMe(token: string): Promise<TelegramBotIdentity>;
  sendMessage(
    token: string,
    chatId: string,
    body: string,
  ): Promise<{ messageId: string }>;
  setWebhook(
    token: string,
    input: { secretToken: string; url: string },
  ): Promise<void>;
}

export interface TelegramRepository {
  disconnect(workspaceId: string): Promise<boolean>;
  findConnection(
    workspaceId: string,
  ): Promise<TelegramConnectionSummary | null>;
  findDeliveryContext(
    workspaceId: string,
    conversationId: string,
    draftId?: string,
  ): Promise<
    | { channel: 'other' }
    | {
        channel: 'telegram';
        chatId: string;
        encryptedCredentials: string;
      }
    | null
  >;
  findWebhookCredential(connectionId: string): Promise<{
    encryptedCredentials: string;
    webhookSecretHash: string;
  } | null>;
  ingest(
    connectionId: string,
    input: TelegramInboundMessage,
  ): Promise<{
    conversationId: string;
    messageId: string;
    ticketNumber: number;
  } | null>;
  saveConnection(input: {
    bot: TelegramBotIdentity;
    connectionId: string;
    encryptedCredentials: string;
    webhookSecretHash: string;
    webhookUrl: string;
    workspaceId: string;
  }): Promise<TelegramConnectionSummary>;
}
