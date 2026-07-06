export interface WidgetMessageInput {
  body: string;
  displayName: string | null;
  email: string | null;
  externalMessageId: string;
  externalThreadId: string;
  externalVisitorId: string;
  publicAccessTokenHash: string;
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

export interface InboxConversationSummary {
  channel: 'web' | 'telegram' | 'whatsapp' | 'gmail';
  conversationId: string;
  customerDisplayName: string | null;
  customerEmail: string | null;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status:
    | 'open'
    | 'ai_replied'
    | 'escalated'
    | 'waiting_customer'
    | 'waiting_agent'
    | 'resolved'
    | 'closed';
  ticketId: string;
  ticketNumber: number;
}

export interface InboxMessage {
  authorKind: 'customer' | 'agent' | 'ai' | 'system';
  body: string;
  direction: 'inbound' | 'outbound';
  id: string;
  occurredAt: Date;
}

export interface InboxConversationDetail extends InboxConversationSummary {
  aiDraft: AiDraft | null;
  messages: InboxMessage[];
  notes: InboxNote[];
}

export interface AiDraftCitation {
  characterEnd: number;
  characterStart: number;
  content: string;
  documentId: string;
  heading: string | null;
  keywordRank: number | null;
  semanticRank: number | null;
  title: string;
  versionId: string;
}

export interface AiDraft {
  body: string;
  citations: AiDraftCitation[];
  createdAt: Date;
  escalationReason: string | null;
  id: string;
  model: string;
  promptVersion: string;
  provider: string;
  readinessScore: number;
  requiresHuman: boolean;
  retrievalMode: 'hybrid' | 'keyword';
}

export interface AiDraftContext {
  conversationId: string;
  inputMessageBody: string;
  inputMessageId: string;
  ticketId: string;
  transcript: Array<{ authorKind: InboxMessage['authorKind']; body: string }>;
}

export interface CreateAiDraftRecord extends Omit<AiDraft, 'createdAt' | 'id'> {
  conversationId: string;
  inputMessageId: string;
  requestedByUserId: string;
  ticketId: string;
  workspaceId: string;
}

export interface InboxNote {
  authorUserId: string;
  body: string;
  createdAt: Date;
  id: string;
}

export interface TicketUpdate {
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?:
    | 'open'
    | 'escalated'
    | 'waiting_customer'
    | 'waiting_agent'
    | 'resolved'
    | 'closed';
}

export interface WidgetConversationRead {
  messages: InboxMessage[];
}

export interface SupportRepository {
  addInboxNote(
    workspaceId: string,
    conversationId: string,
    userId: string,
    body: string,
  ): Promise<InboxNote | null>;
  getInboxConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<InboxConversationDetail | null>;
  getAiDraftContext(
    workspaceId: string,
    conversationId: string,
  ): Promise<AiDraftContext | null>;
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
  listInbox(workspaceId: string): Promise<InboxConversationSummary[]>;
  readWidgetConversation(
    publicKey: string,
    threadId: string,
    tokenHash: string,
  ): Promise<WidgetConversationRead | null>;
  saveAiDraft(input: CreateAiDraftRecord): Promise<AiDraft>;
  sendInboxReply(
    workspaceId: string,
    conversationId: string,
    userId: string,
    body: string,
    draftId?: string,
    externalMessageId?: string,
  ): Promise<InboxMessage | null>;
  updateTicket(
    workspaceId: string,
    conversationId: string,
    input: TicketUpdate,
  ): Promise<InboxConversationSummary | null>;
}
