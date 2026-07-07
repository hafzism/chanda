export interface GmailConnectionSummary {
  emailAddress: string | null;
  id: string | null;
  lastInboundAt: Date | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  name: string;
  oauthConfigured: boolean;
  redirectUri: string;
  status: 'active' | 'disconnected' | 'error';
}

export interface GmailTokenSet {
  accessToken: string;
  refreshToken: string;
}

export interface GmailRawMessage {
  historyId: string;
  id: string;
  internalDate: string;
  labelIds?: string[];
  payload: {
    body?: { data?: string };
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    parts?: GmailRawMessage['payload'][];
  };
  threadId: string;
}

export interface GmailInboundMessage {
  body: string;
  externalMessageId: string;
  fromEmail: string;
  fromName: string | null;
  gmailMessageIdHeader: string | null;
  occurredAt: Date;
  subject: string;
  threadId: string;
}

export interface GmailApi {
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<GmailTokenSet>;
  getMessage(accessToken: string, messageId: string): Promise<GmailRawMessage>;
  getProfile(
    accessToken: string,
  ): Promise<{ emailAddress: string; historyId: string }>;
  listHistory(
    accessToken: string,
    historyId: string,
  ): Promise<{ historyId: string; messageIds: string[] } | 'expired'>;
  listInitialMessageIds(accessToken: string): Promise<string[]>;
  refreshAccessToken(refreshToken: string): Promise<string>;
  revoke(refreshToken: string): Promise<void>;
  sendMessage(
    accessToken: string,
    input: { raw: string; threadId: string },
  ): Promise<{ id: string; threadId: string }>;
}

export interface GmailRepository {
  consumeOAuthState(stateHash: string): Promise<{
    requestedByUserId: string;
    workspaceId: string;
  } | null>;
  createOAuthState(input: {
    expiresAt: Date;
    requestedByUserId: string;
    stateHash: string;
    workspaceId: string;
  }): Promise<void>;
  disconnect(workspaceId: string): Promise<boolean>;
  findConnection(workspaceId: string): Promise<GmailConnectionSummary | null>;
  findCredential(workspaceId: string): Promise<{
    connectionId: string;
    encryptedCredentials: string;
    settings: Record<string, unknown>;
  } | null>;
  findDeliveryContext(
    workspaceId: string,
    conversationId: string,
    draftId?: string,
  ): Promise<
    | { channel: 'other' }
    | {
        channel: 'gmail';
        encryptedCredentials: string;
        messageIdHeader: string | null;
        subject: string;
        threadId: string;
        to: string;
      }
    | null
  >;
  ingest(
    connectionId: string,
    input: GmailInboundMessage,
  ): Promise<{
    conversationId: string;
    messageId: string;
    ticketNumber: number;
  }>;
  markSyncFailure(workspaceId: string, message: string): Promise<void>;
  saveConnection(input: {
    connectionId: string;
    emailAddress: string;
    encryptedCredentials: string;
    historyId: string;
    workspaceId: string;
  }): Promise<GmailConnectionSummary>;
  saveSyncSuccess(
    workspaceId: string,
    historyId: string,
    syncedAt: Date,
  ): Promise<void>;
}
