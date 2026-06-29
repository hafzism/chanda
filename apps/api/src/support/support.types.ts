export interface WidgetMessageInput {
  body: string;
  displayName: string | null;
  email: string | null;
  externalMessageId: string;
  externalThreadId: string;
  externalVisitorId: string;
  publicKey: string;
}

export interface WidgetMessageResult {
  conversationId: string;
  messageId: string;
  ticketNumber: number;
}

export interface WebChannelSummary {
  allowedOrigins: string[];
  id: string;
  lastInboundAt: Date | null;
  name: string;
  publicKey: string;
  status: 'active' | 'disconnected' | 'error';
}

export interface WidgetConnectionPolicy {
  allowedOrigins: string[];
}

export interface SupportRepository {
  findWidgetConnectionPolicy(
    publicKey: string,
  ): Promise<WidgetConnectionPolicy | null>;
  getWebChannel(workspaceId: string): Promise<WebChannelSummary | null>;
  ingestWidgetMessage(
    input: WidgetMessageInput,
  ): Promise<WidgetMessageResult | null>;
  updateWidgetOrigins(
    workspaceId: string,
    origins: string[],
  ): Promise<WebChannelSummary | null>;
}
