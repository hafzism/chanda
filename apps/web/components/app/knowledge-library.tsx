'use client';

import {
  BookOpen,
  FileText,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createKnowledgeArticle,
  deleteKnowledge,
  inspectKnowledgeChunks,
  listKnowledge,
  reindexKnowledge,
  searchKnowledge,
  setKnowledgeEnabled,
  uploadKnowledgeFile,
  type KnowledgeDocument,
  type KnowledgeSearchResponse,
  type KnowledgeChunkInspection,
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
  const [uploading, setUploading] = useState(false);
  const [inspecting, setInspecting] = useState<KnowledgeDocument>();
  const fileInput = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (
      !documents?.some(
        ({ status }) => status === 'queued' || status === 'processing',
      )
    )
      return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [documents, load]);

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Knowledge files must be 8 MB or smaller.');
      input.value = '';
      return;
    }

    setUploading(true);
    setError(undefined);
    try {
      const document = await uploadKnowledgeFile(workspaceId, file);
      setDocuments((current) => [document, ...(current ?? [])]);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Upload failed.');
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

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

  async function reindex(document: KnowledgeDocument) {
    setBusyId(document.id);
    setError(undefined);
    try {
      await reindexKnowledge(workspaceId, document.id);
      setDocuments((current) =>
        current?.map((item) =>
          item.id === document.id ? { ...item, status: 'queued' } : item,
        ),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Re-indexing failed.',
      );
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
          <div className="knowledge-toolbar-actions">
            <input
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              aria-label="Choose a PDF, TXT, or Markdown knowledge file"
              hidden
              onChange={(event) => void uploadFile(event)}
              ref={fileInput}
              type="file"
            />
            <button
              className="button secondary-button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              <Upload size={17} /> {uploading ? 'Uploading…' : 'Upload file'}
            </button>
            <button
              className="button primary-button"
              disabled={uploading}
              onClick={() => setComposerOpen(true)}
              type="button"
            >
              <Plus size={17} /> Add article
            </button>
          </div>
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
            <p className="knowledge-empty-hint">
              Use Upload file above for PDF, TXT, or Markdown, or write an
              article directly.
            </p>
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
                  {document.sourceKind === 'file'
                    ? fileType(document.mimeType)
                    : 'Article'}{' '}
                  · version {document.version}
                  {document.status === 'ready'
                    ? ` · ${document.chunkCount} evidence chunks`
                    : ''}
                </p>
              </div>
              <div className="knowledge-actions">
                {document.status === 'ready' && document.chunkCount > 0 && (
                  <button
                    aria-label={`View indexed evidence for ${document.title}`}
                    onClick={() => setInspecting(document)}
                    title="View indexed evidence"
                    type="button"
                  >
                    <Eye size={17} />
                  </button>
                )}
                {canManage &&
                  (document.status === 'ready' ||
                    document.status === 'failed') && (
                    <button
                      aria-label={`Re-index ${document.title}`}
                      disabled={busyId === document.id}
                      onClick={() => void reindex(document)}
                      title={
                        document.status === 'failed'
                          ? 'Retry indexing'
                          : 'Re-index source'
                      }
                      type="button"
                    >
                      <RotateCcw size={17} />
                    </button>
                  )}
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

      <RetrievalTester workspaceId={workspaceId} />

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
      {inspecting && (
        <ChunkInspector
          document={inspecting}
          onClose={() => setInspecting(undefined)}
          workspaceId={workspaceId}
        />
      )}
    </section>
  );
}

function ChunkInspector({
  document,
  onClose,
  workspaceId,
}: {
  document: KnowledgeDocument;
  onClose: () => void;
  workspaceId: string;
}) {
  const [inspection, setInspection] = useState<KnowledgeChunkInspection>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setInspection(await inspectKnowledgeChunks(workspaceId, document.id));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load evidence.',
      );
    }
  }, [document.id, workspaceId]);

  useEffect(() => void load(), [load]);

  return (
    <div className="composer-backdrop" role="presentation">
      <section
        aria-labelledby="chunk-inspector-title"
        aria-modal="true"
        className="chunk-inspector"
        role="dialog"
      >
        <header>
          <div>
            <span>Indexed evidence</span>
            <h2 id="chunk-inspector-title">{document.title}</h2>
          </div>
          <button
            aria-label="Close evidence inspector"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>
        {!inspection && !error && (
          <div className="chunk-inspector-state" role="status">
            <RefreshCw aria-hidden="true" size={18} /> Loading evidence…
          </div>
        )}
        {error && (
          <div className="knowledge-error" role="alert">
            <span>{error}</span>
            <button onClick={() => void load()} type="button">
              Try again
            </button>
          </div>
        )}
        {inspection && inspection.chunks.length === 0 && (
          <div className="chunk-inspector-state">
            No indexed chunks are available for this source.
          </div>
        )}
        {inspection && inspection.chunks.length > 0 && (
          <ol>
            {inspection.chunks.map((chunk) => (
              <li key={chunk.id}>
                <div>
                  <strong>Chunk {chunk.ordinal + 1}</strong>
                  <span>{chunk.heading ?? 'Source excerpt'}</span>
                </div>
                <p>{chunk.content}</p>
                <small>
                  Characters {chunk.characterStart}–{chunk.characterEnd}
                </small>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function RetrievalTester({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<KnowledgeSearchResponse>();
  const [error, setError] = useState<string>();
  const [searching, setSearching] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError(undefined);
    try {
      setResponse(await searchKnowledge(workspaceId, query.trim()));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <section
      aria-labelledby="retrieval-tester-title"
      className="retrieval-tester"
    >
      <header>
        <div>
          <span>Retrieval check</span>
          <h2 id="retrieval-tester-title">Test what Suppline can find</h2>
        </div>
        {response && (
          <span className="retrieval-mode">
            {response.mode === 'hybrid' ? 'Hybrid search' : 'Keyword fallback'}
          </span>
        )}
      </header>
      <p>
        Ask a realistic customer question and inspect the exact evidence that
        would be available to an AI draft.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="knowledge-test-query">Customer question</label>
        <div>
          <input
            id="knowledge-test-query"
            maxLength={500}
            minLength={2}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Can I return an opened item?"
            required
            value={query}
          />
          <button
            className="button primary-button"
            disabled={searching || query.trim().length < 2}
            type="submit"
          >
            <Search size={16} /> {searching ? 'Searching…' : 'Test retrieval'}
          </button>
        </div>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {response && response.results.length === 0 && (
        <div className="retrieval-empty" role="status">
          No enabled, indexed source matched this question. Add clearer source
          wording or try another customer phrasing.
        </div>
      )}
      {response && response.results.length > 0 && (
        <ol className="retrieval-results">
          {response.results.map((result) => (
            <li key={result.chunkId}>
              <div>
                <strong>{result.metadata.title}</strong>
                <span>{result.metadata.heading ?? 'Source excerpt'}</span>
              </div>
              <p>{result.metadata.content}</p>
              <small>
                Evidence #{response.results.indexOf(result) + 1}
                {result.keywordRank
                  ? ` · keyword rank ${result.keywordRank}`
                  : ''}
                {result.semanticRank
                  ? ` · semantic rank ${result.semanticRank}`
                  : ''}
              </small>
            </li>
          ))}
        </ol>
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

function fileType(mimeType: string) {
  if (mimeType === 'application/pdf') return 'PDF file';
  if (mimeType === 'text/markdown') return 'Markdown file';
  return 'Text file';
}
