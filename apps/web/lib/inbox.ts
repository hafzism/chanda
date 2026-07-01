export interface InboxConversation {
  channel: 'web' | 'telegram' | 'whatsapp' | 'gmail';
  conversationId: string;
  customerDisplayName: string | null;
  customerEmail: string | null;
  lastMessageAt: string;
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
  occurredAt: string;
}

export interface InboxConversationDetail extends InboxConversation {
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
  createdAt: string;
  escalationReason: string | null;
  id: string;
  model: string;
  promptVersion: string;
  provider: string;
  readinessScore: number;
  requiresHuman: boolean;
  retrievalMode: 'hybrid' | 'keyword';
}

export interface InboxNote {
  authorUserId: string;
  body: string;
  createdAt: string;
  id: string;
}

async function inboxRequest<T>(
  path: string,
  init?: { body?: unknown; method?: 'PATCH' | 'POST' },
): Promise<T> {
  const request: RequestInit = { cache: 'no-store' };
  if (init?.method) request.method = init.method;
  if (init?.body) {
    request.body = JSON.stringify(init.body);
    request.headers = { 'Content-Type': 'application/json' };
  }
  const response = await fetch(`/api/v1${path}`, request);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new Error(message ?? 'The inbox request could not be completed.');
  }
  return response.json() as Promise<T>;
}

export function listInbox(workspaceId: string) {
  return inboxRequest<InboxConversation[]>(`/workspaces/${workspaceId}/inbox`);
}

export function getInboxConversation(
  workspaceId: string,
  conversationId: string,
) {
  return inboxRequest<InboxConversationDetail>(
    `/workspaces/${workspaceId}/inbox/${conversationId}`,
  );
}

export function updateTicket(
  workspaceId: string,
  conversationId: string,
  input: {
    priority?: InboxConversation['priority'];
    status?: InboxConversation['status'];
  },
) {
  return inboxRequest<InboxConversation>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/ticket`,
    { body: input, method: 'PATCH' },
  );
}

export function addInboxNote(
  workspaceId: string,
  conversationId: string,
  body: string,
) {
  return inboxRequest<InboxNote>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/notes`,
    { body: { body }, method: 'POST' },
  );
}

export function sendInboxReply(
  workspaceId: string,
  conversationId: string,
  body: string,
  draftId?: string,
) {
  return inboxRequest<InboxMessage>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/replies`,
    { body: { body, ...(draftId ? { draftId } : {}) }, method: 'POST' },
  );
}

export function generateAiDraft(workspaceId: string, conversationId: string) {
  return inboxRequest<AiDraft>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/ai-draft`,
    { method: 'POST' },
  );
}
