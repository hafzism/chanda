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

export function listInbox(workspaceId: string) {
  return apiRequest<InboxConversation[]>(`/workspaces/${workspaceId}/inbox`);
}

export function getInboxConversation(
  workspaceId: string,
  conversationId: string,
) {
  return apiRequest<InboxConversationDetail>(
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
  return apiRequest<InboxConversation>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/ticket`,
    { body: JSON.stringify(input), method: 'PATCH' },
  );
}

export function addInboxNote(
  workspaceId: string,
  conversationId: string,
  body: string,
) {
  return apiRequest<InboxNote>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/notes`,
    { body: JSON.stringify({ body }), method: 'POST' },
  );
}

export function sendInboxReply(
  workspaceId: string,
  conversationId: string,
  body: string,
  draftId?: string,
) {
  return apiRequest<InboxMessage>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/replies`,
    {
      body: JSON.stringify({ body, ...(draftId ? { draftId } : {}) }),
      method: 'POST',
    },
  );
}

export function generateAiDraft(workspaceId: string, conversationId: string) {
  return apiRequest<AiDraft>(
    `/workspaces/${workspaceId}/inbox/${conversationId}/ai-draft`,
    { method: 'POST' },
  );
}
import { apiRequest } from './api-client';
