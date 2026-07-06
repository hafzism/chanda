'use client';

import {
  Check,
  Clipboard,
  Globe2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createWidgetEmbedCode,
  getWebChannel,
  normalizeWebsiteOrigin,
  updateWebChannelOrigins,
  type WebChannel,
} from '../../lib/channels';
import { TelegramChannelCard } from './telegram-channel-card';

export function ChannelsPanel({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [channel, setChannel] = useState<WebChannel>();
  const [draftOrigins, setDraftOrigins] = useState<string[]>([]);
  const [originInput, setOriginInput] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [browserOrigin, setBrowserOrigin] = useState('');

  useEffect(() => setBrowserOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const loaded = await getWebChannel(workspaceId);
      setChannel(loaded);
      setDraftOrigins(loaded.allowedOrigins);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load channels.',
      );
    }
  }, [workspaceId]);

  useEffect(() => void load(), [load]);

  const hasChanges = useMemo(
    () =>
      channel !== undefined &&
      JSON.stringify([...draftOrigins].sort()) !==
        JSON.stringify([...channel.allowedOrigins].sort()),
    [channel, draftOrigins],
  );

  function addOrigin() {
    setError(undefined);
    setNotice(undefined);
    try {
      const normalized = normalizeWebsiteOrigin(originInput);
      if (draftOrigins.includes(normalized)) {
        setError('That website is already allowed.');
        return;
      }
      if (draftOrigins.length >= 10) {
        setError('A web channel can allow up to 10 websites.');
        return;
      }
      setDraftOrigins((current) => [...current, normalized].sort());
      setOriginInput('');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Invalid website.');
    }
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const updated = await updateWebChannelOrigins(workspaceId, draftOrigins);
      setChannel(updated);
      setDraftOrigins(updated.allowedOrigins);
      setNotice('Allowed websites saved.');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  async function copyKey() {
    if (!channel) return;
    setError(undefined);
    try {
      await navigator.clipboard.writeText(channel.publicKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError(
        'Your browser blocked clipboard access. Select the key manually.',
      );
    }
  }

  async function copyEmbedCode(code: string) {
    setError(undefined);
    try {
      await navigator.clipboard.writeText(code);
      setEmbedCopied(true);
      window.setTimeout(() => setEmbedCopied(false), 1_800);
    } catch {
      setError(
        'Your browser blocked clipboard access. Select the embed code manually.',
      );
    }
  }

  if (!channel && !error) {
    return (
      <section aria-live="polite" className="channels-loading">
        <RefreshCw aria-hidden="true" size={20} />
        <p>Checking channel security…</p>
      </section>
    );
  }

  if (!channel) {
    return (
      <section className="channels-failed" role="alert">
        <Globe2 size={24} />
        <h2>We couldn’t load your web channel</h2>
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

  const isReady = channel.status === 'active' && draftOrigins.length > 0;
  const embedCode = browserOrigin
    ? createWidgetEmbedCode({
        apiOrigin:
          process.env.NEXT_PUBLIC_WIDGET_API_ORIGIN ??
          (new URL(browserOrigin).hostname === 'localhost'
            ? 'http://localhost:4000'
            : browserOrigin),
        publicKey: channel.publicKey,
        scriptOrigin: browserOrigin,
      })
    : '';

  return (
    <section className="channels-panel">
      <article className="channel-card">
        <header>
          <span className="channel-icon">
            <Globe2 size={22} />
          </span>
          <div>
            <p>First-party channel</p>
            <h2>{channel.name}</h2>
          </div>
          <span className={`channel-readiness ${isReady ? 'ready' : 'setup'}`}>
            {isReady ? <Check size={14} /> : <ShieldCheck size={14} />}
            {isReady ? 'Ready' : 'Needs a website'}
          </span>
        </header>

        <div className="channel-body">
          <div className="origin-settings">
            <div className="channel-section-heading">
              <div>
                <h3>Allowed websites</h3>
                <p>
                  The widget accepts browser messages only from these exact
                  origins.
                </p>
              </div>
              <span>{draftOrigins.length}/10</span>
            </div>

            {canManage && (
              <div className="origin-composer">
                <label htmlFor="widget-origin">Website origin</label>
                <div>
                  <input
                    disabled={saving}
                    id="widget-origin"
                    onChange={(event) => setOriginInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addOrigin();
                      }
                    }}
                    placeholder="https://support.example.com"
                    type="url"
                    value={originInput}
                  />
                  <button
                    className="button secondary-button"
                    disabled={!originInput.trim() || saving}
                    onClick={addOrigin}
                    type="button"
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>
            )}

            {draftOrigins.length === 0 ? (
              <div className="origins-empty">
                <ShieldCheck size={20} />
                <div>
                  <strong>No browser website is allowed yet</strong>
                  <p>
                    Add the exact site where customers will open your support
                    widget.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="origin-list">
                {draftOrigins.map((origin) => (
                  <li key={origin}>
                    <span aria-hidden="true" />
                    <code>{origin}</code>
                    {canManage && (
                      <button
                        aria-label={`Remove ${origin}`}
                        disabled={saving}
                        onClick={() =>
                          setDraftOrigins((current) =>
                            current.filter((item) => item !== origin),
                          )
                        }
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="channel-message error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="channel-message success" role="status">
                <Check size={15} /> {notice}
              </p>
            )}

            {canManage && (
              <div className="channel-actions">
                <button
                  className="button primary-button"
                  disabled={!hasChanges || saving}
                  onClick={() => void save()}
                  type="button"
                >
                  {saving ? 'Saving…' : 'Save websites'}
                </button>
              </div>
            )}
          </div>

          <aside className="channel-details">
            <h3>Connection details</h3>
            <p>
              This public key identifies your web channel. It cannot read
              customer conversations or access your workspace.
            </p>
            <label>Public connection key</label>
            <div className="connection-key">
              <code>{channel.publicKey}</code>
              <button
                aria-label="Copy public connection key"
                onClick={() => void copyKey()}
                type="button"
              >
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
              </button>
            </div>
            <dl>
              <div>
                <dt>Endpoint</dt>
                <dd>
                  {channel.status === 'active' ? 'Active' : channel.status}
                </dd>
              </div>
              <div>
                <dt>Last inbound message</dt>
                <dd>
                  {channel.lastInboundAt
                    ? new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(channel.lastInboundAt))
                    : 'None yet'}
                </dd>
              </div>
            </dl>
            {embedCode && (
              <div className="embed-code">
                <div>
                  <label>Website embed code</label>
                  <button
                    onClick={() => void copyEmbedCode(embedCode)}
                    type="button"
                  >
                    {embedCopied ? (
                      <Check size={15} />
                    ) : (
                      <Clipboard size={15} />
                    )}
                    {embedCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre tabIndex={0}>
                  <code>{embedCode}</code>
                </pre>
                <p>Paste this once before your website’s closing body tag.</p>
              </div>
            )}
          </aside>
        </div>
      </article>
      <TelegramChannelCard canManage={canManage} workspaceId={workspaceId} />
    </section>
  );
}
