'use client';

import {
  Check,
  Clipboard,
  ExternalLink,
  Mail,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  beginGmailOAuth,
  disconnectGmailChannel,
  getGmailChannel,
  type GmailChannel,
  syncGmailChannel,
} from '../../lib/channels';

export function GmailChannelCard({
  canManage,
  canOperate,
  workspaceId,
}: {
  canManage: boolean;
  canOperate: boolean;
  workspaceId: string;
}) {
  const [channel, setChannel] = useState<GmailChannel>();
  const [busy, setBusy] = useState<'connect' | 'disconnect' | 'sync'>();
  const [disconnectArmed, setDisconnectArmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setChannel(await getGmailChannel(workspaceId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load Gmail status.',
      );
    }
  }, [workspaceId]);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const outcome = parameters.get('gmail');
    if (!outcome) return;
    if (outcome === 'connected') {
      setNotice(
        'Gmail connected. Run the first sync when you are ready to import messages.',
      );
      void load();
    } else {
      setError(parameters.get('message') ?? 'Gmail connection failed.');
    }
    parameters.delete('gmail');
    parameters.delete('message');
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${parameters.size ? `?${parameters}` : ''}`,
    );
  }, [load]);

  async function connect() {
    setBusy('connect');
    setError(undefined);
    setNotice(undefined);
    try {
      const { authorizationUrl } = await beginGmailOAuth(workspaceId);
      window.location.assign(authorizationUrl);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Gmail connection failed.',
      );
      setBusy(undefined);
    }
  }

  async function sync() {
    setBusy('sync');
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await syncGmailChannel(workspaceId);
      await load();
      setNotice(
        result.imported === 1
          ? 'Sync complete. 1 inbound message was added to the Inbox.'
          : `Sync complete. ${result.imported} inbound messages were added to the Inbox.`,
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Gmail sync failed.');
      await load();
    } finally {
      setBusy(undefined);
    }
  }

  async function disconnect() {
    if (!disconnectArmed) {
      setDisconnectArmed(true);
      return;
    }
    setBusy('disconnect');
    setError(undefined);
    setNotice(undefined);
    try {
      await disconnectGmailChannel(workspaceId);
      await load();
      setDisconnectArmed(false);
      setNotice(
        'Gmail disconnected. Existing inbox conversations were retained.',
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Gmail disconnect failed.',
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function copyRedirectUri() {
    if (!channel) return;
    try {
      await navigator.clipboard.writeText(channel.redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError(
        'Your browser blocked clipboard access. Select the redirect URI manually.',
      );
    }
  }

  if (!channel && !error) {
    return (
      <article className="channel-card gmail-card gmail-card-loading">
        <RefreshCw className="spin" size={20} /> Checking Gmail…
      </article>
    );
  }

  const connected = Boolean(
    channel?.id && channel.emailAddress && channel.status !== 'disconnected',
  );
  const hasSynced = Boolean(channel?.lastSyncAt);

  return (
    <article className="channel-card gmail-card">
      <header>
        <span className="channel-icon">
          <Mail size={21} />
        </span>
        <div>
          <p>Email channel</p>
          <h2>{connected ? channel?.emailAddress : 'Gmail'}</h2>
        </div>
        <span className={`channel-readiness ${connected ? 'ready' : 'setup'}`}>
          {connected ? <Check size={14} /> : <ShieldCheck size={14} />}
          {connected ? 'Connected' : 'Needs setup'}
        </span>
      </header>

      <div className="gmail-body">
        {connected ? (
          <div className="gmail-connected">
            <div className="gmail-summary">
              <div>
                <strong>Mailbox synchronization is manual</strong>
                <p>
                  Inbound Gmail threads become Suppline tickets. Replies from
                  the Inbox are sent from this mailbox and remain in the
                  original thread.
                </p>
              </div>
              {channel?.status === 'error' && (
                <span className="gmail-sync-warning">
                  Last sync needs attention
                </span>
              )}
            </div>
            <dl>
              <div>
                <dt>Last sync</dt>
                <dd>{formatDate(channel?.lastSyncAt, 'Not synced yet')}</dd>
              </div>
              <div>
                <dt>Last inbound</dt>
                <dd>{formatDate(channel?.lastInboundAt, 'No messages yet')}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>Read Gmail and send replies</dd>
              </div>
            </dl>
            {!hasSynced && (
              <div className="gmail-first-sync">
                <ShieldCheck size={18} />
                <p>
                  The first sync imports at most 50 inbox messages from the last
                  30 days. It ignores mail sent by this account and never sends
                  an automatic reply.
                </p>
              </div>
            )}
            {channel?.lastSyncError && (
              <p className="channel-message error" role="alert">
                {channel.lastSyncError}
              </p>
            )}
            <div className="gmail-actions">
              {canOperate && (
                <button
                  className="button primary-button"
                  disabled={Boolean(busy)}
                  onClick={() => void sync()}
                  type="button"
                >
                  <RefreshCw
                    className={busy === 'sync' ? 'spin' : ''}
                    size={15}
                  />
                  {busy === 'sync'
                    ? 'Syncing inbox…'
                    : hasSynced
                      ? 'Sync now'
                      : 'Run first sync'}
                </button>
              )}
              <a
                className="button secondary-button"
                href="https://myaccount.google.com/permissions"
                rel="noreferrer"
                target="_blank"
              >
                Google permissions <ExternalLink size={14} />
              </a>
              {canManage && (
                <button
                  className={`button gmail-disconnect ${disconnectArmed ? 'armed' : ''}`}
                  disabled={Boolean(busy)}
                  onBlur={() => setDisconnectArmed(false)}
                  onClick={() => void disconnect()}
                  type="button"
                >
                  <Unplug size={15} />
                  {busy === 'disconnect'
                    ? 'Disconnecting…'
                    : disconnectArmed
                      ? 'Confirm disconnect'
                      : 'Disconnect'}
                </button>
              )}
            </div>
          </div>
        ) : canManage ? (
          <div className="gmail-setup">
            {!channel?.oauthConfigured ? (
              <>
                <div className="gmail-guide-heading">
                  <div>
                    <strong>Configure Google Cloud once</strong>
                    <p>
                      Firebase sign-in and Gmail mailbox access are separate.
                      Gmail needs a server-side Google OAuth web client.
                    </p>
                  </div>
                  <a
                    href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Google Cloud <ExternalLink size={13} />
                  </a>
                </div>
                <ol className="gmail-guide">
                  <li>Enable the Gmail API in your Google Cloud project.</li>
                  <li>
                    Configure the OAuth consent screen. While the app is in
                    testing, add the Gmail account you will connect as a test
                    user.
                  </li>
                  <li>
                    Create an OAuth client with application type “Web
                    application.”
                  </li>
                  <li>Add this exact authorized redirect URI:</li>
                </ol>
                <div className="gmail-redirect-uri">
                  <code>{channel?.redirectUri}</code>
                  <button
                    aria-label="Copy Gmail OAuth redirect URI"
                    onClick={() => void copyRedirectUri()}
                    type="button"
                  >
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="gmail-env-help">
                  Put the client ID and secret in{' '}
                  <code>GOOGLE_GMAIL_CLIENT_ID</code>
                  {' and '}
                  <code>GOOGLE_GMAIL_CLIENT_SECRET</code>, set the URI in{' '}
                  <code>GMAIL_OAUTH_REDIRECT_URI</code>, then restart the API.
                </p>
                <button
                  className="button secondary-button"
                  onClick={() => void load()}
                  type="button"
                >
                  Recheck configuration
                </button>
              </>
            ) : (
              <div className="gmail-ready-to-connect">
                <ShieldCheck size={25} />
                <div>
                  <strong>Connect a support mailbox</strong>
                  <p>
                    Google will ask for permission to read Gmail and send
                    replies. Suppline stores only an encrypted refresh
                    credential and will not import mail until you run the first
                    sync.
                  </p>
                  <button
                    className="button primary-button"
                    disabled={Boolean(busy)}
                    onClick={() => void connect()}
                    type="button"
                  >
                    <Mail size={15} />
                    {busy === 'connect'
                      ? 'Opening Google…'
                      : 'Connect with Google'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="telegram-viewer-empty">
            <ShieldCheck size={22} />
            <div>
              <strong>Gmail is not connected</strong>
              <p>A workspace owner or admin can configure a support mailbox.</p>
            </div>
          </div>
        )}

        {error && (
          <p className="channel-message error" role="alert">
            {error}
            <button onClick={() => void load()} type="button">
              Retry
            </button>
          </p>
        )}
        {notice && (
          <p className="channel-message success" role="status">
            <Check size={15} /> {notice}
          </p>
        )}
      </div>
    </article>
  );
}

function formatDate(value: string | null | undefined, empty: string) {
  if (!value) return empty;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
