'use client';

import { BookOpen, FileText, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  createKnowledgeArticle,
  deleteKnowledge,
  listKnowledge,
  setKnowledgeEnabled,
  type KnowledgeDocument,
} from '../../lib/knowledge';

export function KnowledgeLibrary({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>();
  const [error, setError] = useState<string>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setDocuments(await listKnowledge(workspaceId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load knowledge.',
      );
    }
  }, [workspaceId]);

  useEffect(() => void load(), [load]);

  async function toggle(document: KnowledgeDocument) {
    setBusyId(document.id);
    setError(undefined);
    try {
      await setKnowledgeEnabled(workspaceId, document.id, !document.isEnabled);
      setDocuments((current) =>
        current?.map((item) =>
          item.id === document.id
            ? { ...item, isEnabled: !item.isEnabled }
            : item,
        ),
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Update failed.');
    } finally {
      setBusyId(undefined);
    }
  }

  async function remove(document: KnowledgeDocument) {
    if (!window.confirm(`Delete “${document.title}” and its indexed content?`))
      return;
    setBusyId(document.id);
    setError(undefined);
    try {
      await deleteKnowledge(workspaceId, document.id);
      setDocuments((current) =>
        current?.filter((item) => item.id !== document.id),
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Delete failed.');
    } finally {
      setBusyId(undefined);
    }
  }

  if (!documents && !error)
    return (
      <section aria-live="polite" className="knowledge-loading">
        <RefreshCw aria-hidden="true" size={20} />
        <p>Loading approved knowledge…</p>
      </section>
    );

  return (
    <section className="knowledge-library">
      <div className="knowledge-toolbar">
        <div>
          <strong>{documents?.length ?? 0} sources</strong>
          <span>Only enabled, fully indexed sources can ground replies.</span>
        </div>
        {canManage && (
          <button
            className="button primary-button"
            onClick={() => setComposerOpen(true)}
            type="button"
          >
            <Plus size={17} /> Add article
          </button>
        )}
      </div>

      {error && (
        <div className="knowledge-error" role="alert">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Try again
          </button>
        </div>
      )}

      {documents?.length === 0 ? (
        <div className="knowledge-empty">
          <span>
            <BookOpen size={25} />
          </span>
          <h2>Give Suppline approved answers to work from</h2>
          <p>
            Add a policy or help article. Suppline stores the original, indexes
            exact evidence, and cites it when preparing support replies.
          </p>
          {canManage && (
            <button
              className="button secondary-button"
              onClick={() => setComposerOpen(true)}
              type="button"
            >
              Add your first article
            </button>
          )}
        </div>
      ) : (
        <div className="knowledge-list">
          {documents?.map((document) => (
            <article key={document.id}>
              <span className="knowledge-file-icon">
                <FileText size={20} />
              </span>
              <div className="knowledge-document-copy">
                <div>
                  <h2>{document.title}</h2>
                  <span className={`knowledge-status ${document.status}`}>
                    {statusLabel(document.status)}
                  </span>
                </div>
                <p>
                  Article · version {document.version}
                  {document.status === 'ready'
                    ? ` · ${document.chunkCount} evidence chunks`
                    : ''}
                </p>
              </div>
              <div className="knowledge-actions">
                <label>
                  <input
                    checked={document.isEnabled}
                    disabled={!canManage || busyId === document.id}
                    onChange={() => void toggle(document)}
                    type="checkbox"
                  />
                  <span>{document.isEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>
                {canManage && (
                  <button
                    aria-label={`Delete ${document.title}`}
                    disabled={busyId === document.id}
                    onClick={() => void remove(document)}
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {composerOpen && (
        <ArticleComposer
          onClose={() => setComposerOpen(false)}
          onCreated={(document) => {
            setDocuments((current) => [document, ...(current ?? [])]);
            setComposerOpen(false);
          }}
          workspaceId={workspaceId}
        />
      )}
    </section>
  );
}

function ArticleComposer({
  onClose,
  onCreated,
  workspaceId,
}: {
  onClose: () => void;
  onCreated: (document: KnowledgeDocument) => void;
  workspaceId: string;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      onCreated(await createKnowledgeArticle(workspaceId, { content, title }));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to add article.',
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="composer-backdrop" role="presentation">
      <section
        aria-labelledby="article-composer-title"
        aria-modal="true"
        className="article-composer"
        role="dialog"
      >
        <header>
          <div>
            <span>New knowledge source</span>
            <h2 id="article-composer-title">Add an approved article</h2>
          </div>
          <button
            aria-label="Close article editor"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Article title
            <input
              autoFocus
              maxLength={120}
              minLength={2}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Returns and refunds"
              required
              value={title}
            />
          </label>
          <label>
            Approved content
            <textarea
              maxLength={200000}
              minLength={20}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Use headings and clear policy language…"
              required
              rows={13}
              value={content}
            />
          </label>
          <p className="composer-hint">
            Use only information your support team is allowed to share with
            customers.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button
              className="button secondary-button"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button primary-button"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Adding article…' : 'Add and index article'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function statusLabel(status: KnowledgeDocument['status']) {
  return {
    failed: 'Needs attention',
    processing: 'Indexing',
    queued: 'Queued',
    ready: 'Ready',
  }[status];
}
