'use client';

import {
  BookOpen,
  Inbox,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  addInboxNote,
  generateAiDraft,
  getInboxConversation,
  listInbox,
  sendInboxReply,
  type InboxConversation,
  type InboxConversationDetail,
  updateTicket,
} from '../../lib/inbox';

export function InboxPanel({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [items, setItems] = useState<InboxConversation[]>();
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<InboxConversationDetail>();
  const [error, setError] = useState<string>();
  const [detailError, setDetailError] = useState<string>();
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [draft, setDraft] = useState('');
  const [actionError, setActionError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const loaded = await listInbox(workspaceId);
      setItems(loaded);
      setSelectedId((current) =>
        loaded.some((item) => item.conversationId === current)
          ? current
          : loaded[0]?.conversationId,
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load inbox.',
      );
    }
  }, [workspaceId]);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(undefined);
      return;
    }
    setDetail(undefined);
    setDetailError(undefined);
    void getInboxConversation(workspaceId, selectedId)
      .then(setDetail)
      .catch((caught: unknown) =>
        setDetailError(
          caught instanceof Error
            ? caught.message
            : 'Unable to open conversation.',
        ),
      );
  }, [detailAttempt, selectedId, workspaceId]);

  useEffect(() => {
    setActiveDraftId(undefined);
    setDraft('');
    setComposerMode('reply');
    setActionError(undefined);
  }, [selectedId]);

  const refreshSelected = useCallback(async () => {
    if (!selectedId) return;
    const [loadedDetail, loadedItems] = await Promise.all([
      getInboxConversation(workspaceId, selectedId),
      listInbox(workspaceId),
    ]);
    setDetail(loadedDetail);
    setItems(loadedItems);
  }, [selectedId, workspaceId]);

  async function changeTicket(
    input: Parameters<typeof updateTicket>[2],
  ): Promise<void> {
    if (!selectedId) return;
    setSaving(true);
    setActionError(undefined);
    try {
      await updateTicket(workspaceId, selectedId, input);
      await refreshSelected();
    } catch (caught: unknown) {
      setActionError(
        caught instanceof Error ? caught.message : 'Unable to update ticket.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitComposer(): Promise<void> {
    if (!selectedId || !draft.trim()) return;
    setSaving(true);
    setActionError(undefined);
    try {
      if (composerMode === 'reply') {
        await sendInboxReply(workspaceId, selectedId, draft, activeDraftId);
      } else {
        await addInboxNote(workspaceId, selectedId, draft);
      }
      setDraft('');
      setActiveDraftId(undefined);
      await refreshSelected();
    } catch (caught: unknown) {
      setActionError(
        caught instanceof Error ? caught.message : 'Unable to save message.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function createAiDraft(): Promise<void> {
    if (!selectedId) return;
    setSaving(true);
    setActionError(undefined);
    try {
      await generateAiDraft(workspaceId, selectedId);
      await refreshSelected();
    } catch (caught: unknown) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : 'Unable to generate an AI draft.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!items && !error) {
    return (
      <section className="inbox-loading">
        <RefreshCw size={20} />
        <p>Opening the support queue…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="inbox-failed" role="alert">
        <Inbox size={24} />
        <h2>We couldn’t load the inbox</h2>
        <p>{error}</p>
        <button
          className="button secondary-button"
          onClick={() => void load()}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }

  if (items?.length === 0) {
    return (
      <section className="inbox-empty">
        <span>
          <Inbox size={25} />
        </span>
        <h2>Your support queue is clear</h2>
        <p>
          New website conversations appear here as soon as a customer sends a
          message.
        </p>
      </section>
    );
  }

  return (
    <section className="inbox-panel">
      <div className="inbox-list">
        <header>
          <div>
            <strong>All conversations</strong>
            <span>{items?.length ?? 0} total</span>
          </div>
          <button
            aria-label="Refresh inbox"
            onClick={() => void load()}
            type="button"
          >
            <RefreshCw size={16} />
          </button>
        </header>
        <div>
          {items?.map((item) => (
            <button
              className={selectedId === item.conversationId ? 'selected' : ''}
              key={item.conversationId}
              onClick={() => setSelectedId(item.conversationId)}
              type="button"
            >
              <span className="customer-avatar">
                {customerName(item).slice(0, 1).toUpperCase()}
              </span>
              <span className="inbox-item-copy">
                <span>
                  <strong>{customerName(item)}</strong>
                  <time>{shortTime(item.lastMessageAt)}</time>
                </span>
                <span className="ticket-line">
                  #{item.ticketNumber} · {item.channel} ·{' '}
                  {formatStatus(item.status)}
                </span>
                <span className="message-preview">
                  {item.lastMessagePreview ?? 'No message content'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <article className="conversation-view">
        {detailError ? (
          <div className="conversation-state" role="alert">
            <p>{detailError}</p>
            <button
              className="button secondary-button"
              onClick={() => setDetailAttempt((current) => current + 1)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : !detail ? (
          <div className="conversation-state">
            <RefreshCw size={19} />
            <p>Loading conversation…</p>
          </div>
        ) : (
          <>
            <header>
              <div>
                <h2>{customerName(detail)}</h2>
                <p>{detail.customerEmail ?? `${detail.channel} customer`}</p>
              </div>
              <div className="ticket-summary">
                <strong>Ticket #{detail.ticketNumber}</strong>
                {canManage ? (
                  <div className="ticket-controls">
                    <label>
                      <span>Status</span>
                      <select
                        aria-label="Ticket status"
                        disabled={saving}
                        onChange={(event) =>
                          void changeTicket({
                            status: event.target
                              .value as InboxConversation['status'],
                          })
                        }
                        value={detail.status}
                      >
                        {detail.status === 'ai_replied' && (
                          <option disabled value="ai_replied">
                            AI replied
                          </option>
                        )}
                        {ticketStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        aria-label="Ticket priority"
                        disabled={saving}
                        onChange={(event) =>
                          void changeTicket({
                            priority: event.target
                              .value as InboxConversation['priority'],
                          })
                        }
                        value={detail.priority}
                      >
                        {ticketPriorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <span>{formatStatus(detail.status)}</span>
                )}
              </div>
            </header>
            <div className="message-thread">
              {detail.messages.map((message) => (
                <div
                  className={`message-row ${message.direction}`}
                  key={message.id}
                >
                  <div>
                    <span>{formatAuthor(message.authorKind)}</span>
                    <p>{message.body}</p>
                    <time>{fullTime(message.occurredAt)}</time>
                  </div>
                </div>
              ))}
            </div>
            {detail.notes.length > 0 && (
              <aside className="conversation-notes">
                <strong>Internal notes</strong>
                {detail.notes.map((note) => (
                  <div key={note.id}>
                    <p>{note.body}</p>
                    <time>{fullTime(note.createdAt)}</time>
                  </div>
                ))}
              </aside>
            )}
            {canManage && (
              <section className="ai-draft-panel">
                <header>
                  <div>
                    <span>
                      <Sparkles size={15} /> Grounded AI draft
                    </span>
                    <p>Review every draft before it reaches the customer.</p>
                  </div>
                  <button
                    className="button secondary-button"
                    disabled={saving}
                    onClick={() => void createAiDraft()}
                    type="button"
                  >
                    {saving
                      ? 'Generating…'
                      : detail.aiDraft
                        ? 'Regenerate'
                        : 'Generate draft'}
                  </button>
                </header>
                {detail.aiDraft ? (
                  <div className="ai-draft-content">
                    <div className="ai-draft-signal">
                      <span
                        className={
                          detail.aiDraft.requiresHuman ? 'risk' : 'ready'
                        }
                      >
                        {detail.aiDraft.requiresHuman ? (
                          <ShieldAlert size={14} />
                        ) : (
                          <BookOpen size={14} />
                        )}
                        {detail.aiDraft.readinessScore}% evidence readiness
                      </span>
                      <small>{detail.aiDraft.retrievalMode} retrieval</small>
                    </div>
                    {detail.aiDraft.escalationReason && (
                      <p className="ai-escalation">
                        {detail.aiDraft.escalationReason}
                      </p>
                    )}
                    <p className="ai-draft-body">{detail.aiDraft.body}</p>
                    {detail.aiDraft.citations.length > 0 && (
                      <div className="ai-sources">
                        <strong>Evidence used</strong>
                        <ul>
                          {detail.aiDraft.citations.map((citation) => (
                            <li
                              key={`${citation.versionId}:${citation.characterStart}`}
                            >
                              <BookOpen size={13} />
                              <span>
                                {citation.title}
                                {citation.heading
                                  ? ` · ${citation.heading}`
                                  : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      className="button secondary-button"
                      onClick={() => {
                        setComposerMode('reply');
                        setDraft(detail.aiDraft?.body ?? '');
                        setActiveDraftId(detail.aiDraft?.id);
                      }}
                      type="button"
                    >
                      Use and edit draft
                    </button>
                  </div>
                ) : (
                  <p className="ai-draft-empty">
                    Generate a reply from this workspace’s approved knowledge.
                  </p>
                )}
              </section>
            )}
            {canManage && (
              <form
                className="conversation-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitComposer();
                }}
              >
                <div className="composer-tabs" role="tablist">
                  <button
                    aria-selected={composerMode === 'reply'}
                    className={composerMode === 'reply' ? 'active' : ''}
                    onClick={() => setComposerMode('reply')}
                    role="tab"
                    type="button"
                  >
                    Reply
                  </button>
                  <button
                    aria-selected={composerMode === 'note'}
                    className={composerMode === 'note' ? 'active' : ''}
                    onClick={() => {
                      setComposerMode('note');
                      setActiveDraftId(undefined);
                    }}
                    role="tab"
                    type="button"
                  >
                    Internal note
                  </button>
                </div>
                <textarea
                  aria-label={
                    composerMode === 'reply' ? 'Reply message' : 'Internal note'
                  }
                  maxLength={4000}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    composerMode === 'reply'
                      ? 'Write a reply to the customer…'
                      : 'Add context for your team…'
                  }
                  rows={3}
                  value={draft}
                />
                <footer>
                  <span>
                    {actionError ??
                      (activeDraftId ? 'AI-assisted reply · edit freely' : '')}
                  </span>
                  <button
                    className="button primary-button"
                    disabled={saving || !draft.trim()}
                    type="submit"
                  >
                    {saving
                      ? 'Saving…'
                      : composerMode === 'reply'
                        ? 'Send reply'
                        : 'Add note'}
                    {!saving && <Send size={15} />}
                  </button>
                </footer>
              </form>
            )}
          </>
        )}
      </article>
    </section>
  );
}

const ticketStatuses = [
  'open',
  'escalated',
  'waiting_customer',
  'waiting_agent',
  'resolved',
  'closed',
] as const;

const ticketPriorities = ['low', 'normal', 'high', 'urgent'] as const;

function customerName(item: InboxConversation): string {
  return item.customerDisplayName ?? item.customerEmail ?? 'Website visitor';
}

function formatStatus(value: string): string {
  return value.replaceAll('_', ' ');
}

function formatAuthor(value: string): string {
  return value === 'ai'
    ? 'Chanda AI'
    : value[0]?.toUpperCase() + value.slice(1);
}

function shortTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function fullTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
