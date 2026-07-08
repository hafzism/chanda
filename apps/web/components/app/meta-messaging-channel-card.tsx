'use client';

import {
  Check,
  Clipboard,
  Camera,
  ExternalLink,
  Eye,
  EyeOff,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  connectMetaMessagingChannel,
  disconnectMetaMessagingChannel,
  getMetaMessagingChannel,
  type MetaChannelKind,
  type MetaMessagingChannel,
} from '../../lib/channels';

export function MetaMessagingChannelCard({
  canManage,
  kind,
  workspaceId,
}: {
  canManage: boolean;
  kind: MetaChannelKind;
  workspaceId: string;
}) {
  const config = channelConfig[kind];
  const [channel, setChannel] = useState<MetaMessagingChannel>();
  const [assetId, setAssetId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disconnectArmed, setDisconnectArmed] = useState(false);
  const [copied, setCopied] = useState<'token' | 'url'>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setChannel(await getMetaMessagingChannel(workspaceId, kind));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Unable to load ${config.label} status.`,
      );
    }
  }, [config.label, kind, workspaceId]);

  useEffect(() => void load(), [load]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const connected = await connectMetaMessagingChannel(workspaceId, kind, {
        appSecret,
        assetId,
        pageAccessToken,
      });
      setChannel(connected);
      setAppSecret('');
      setAssetId('');
      setPageAccessToken('');
      setShowSecrets(false);
      setShowCredentials(false);
      setNotice(
        `${config.label} credentials verified. Finish the webhook using the values below.`,
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : `${config.label} setup failed.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!disconnectArmed) {
      setDisconnectArmed(true);
      return;
    }
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await disconnectMetaMessagingChannel(workspaceId, kind);
      await load();
      setDisconnectArmed(false);
      setNotice(
        `${config.label} disconnected. Existing tickets were retained.`,
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Disconnect failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, copiedKind: 'token' | 'url') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(copiedKind);
      window.setTimeout(() => setCopied(undefined), 1_800);
    } catch {
      setError(
        'Your browser blocked clipboard access. Select the value manually.',
      );
    }
  }

  if (!channel && !error) {
    return (
      <article className="channel-card meta-card meta-card-loading">
        <RefreshCw className="spin" size={19} /> Checking {config.label}…
      </article>
    );
  }

  const connected = Boolean(
    channel?.id && channel.assetId && channel.status !== 'disconnected',
  );
  const webhookReady = Boolean(channel?.webhookVerifiedAt);
  const Icon = config.icon;

  return (
    <article className="channel-card meta-card">
      <header>
        <span className="channel-icon">
          <Icon size={21} />
        </span>
        <div>
          <p>Social messaging</p>
          <h2>{connected ? channel?.assetName : config.label}</h2>
        </div>
        <span
          className={`channel-readiness ${webhookReady ? 'ready' : 'setup'}`}
        >
          {webhookReady ? <Check size={14} /> : <ShieldCheck size={14} />}
          {webhookReady
            ? 'Verified'
            : connected
              ? 'Finish webhook'
              : 'Test mode'}
        </span>
      </header>

      <div className="meta-card-body">
        {connected && !showCredentials ? (
          <div className="meta-connected">
            <p>
              {webhookReady
                ? `${config.label} text messages now create inbox tickets. Replies stay within Meta's standard 24-hour messaging window.`
                : `Credentials are valid. Configure the ${config.webhookProduct} webhook to start receiving messages.`}
            </p>
            {!webhookReady && (
              <div className="meta-webhook-setup">
                <ol>
                  <li>
                    Open {config.webhookProduct} webhooks in your Meta app.
                  </li>
                  <li>Paste the callback URL and verify token.</li>
                  <li>{config.subscriptionStep}</li>
                </ol>
                <MetaWebhookValue
                  copied={copied === 'url'}
                  label="Callback URL"
                  onCopy={() => {
                    if (channel?.webhookUrl)
                      void copy(channel.webhookUrl, 'url');
                  }}
                  value={channel?.webhookUrl ?? ''}
                />
                {channel?.verifyToken ? (
                  <MetaWebhookValue
                    copied={copied === 'token'}
                    label="One-time verify token"
                    onCopy={() => {
                      if (channel.verifyToken)
                        void copy(channel.verifyToken, 'token');
                    }}
                    value={channel.verifyToken}
                  />
                ) : (
                  <p className="meta-token-lost">
                    Replace credentials to generate another verify token if the
                    previous one was not entered in Meta.
                  </p>
                )}
                <button
                  className="button secondary-button"
                  disabled={busy}
                  onClick={() => void load()}
                  type="button"
                >
                  <RefreshCw size={14} /> Recheck webhook
                </button>
              </div>
            )}
            <dl>
              <div>
                <dt>Account ID</dt>
                <dd>{channel?.assetId}</dd>
              </div>
              <div>
                <dt>Last inbound</dt>
                <dd>{formatDate(channel?.lastInboundAt)}</dd>
              </div>
            </dl>
            <div className="meta-actions">
              <a
                href="https://developers.facebook.com/apps/"
                rel="noreferrer"
                target="_blank"
              >
                Meta app <ExternalLink size={12} />
              </a>
              {canManage && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setDisconnectArmed(false);
                    setShowCredentials(true);
                  }}
                  type="button"
                >
                  Replace credentials
                </button>
              )}
              {canManage && (
                <button
                  className={disconnectArmed ? 'danger' : ''}
                  disabled={busy}
                  onBlur={() => setDisconnectArmed(false)}
                  onClick={() => void disconnect()}
                  type="button"
                >
                  <Unplug size={13} />
                  {disconnectArmed ? 'Confirm disconnect' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>
        ) : canManage ? (
          <div className="meta-setup">
            <div className="meta-guide">
              <strong>{config.setupTitle}</strong>
              <p>{config.setupDescription}</p>
              <ol>
                {config.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="meta-test-boundary">
                Development mode is free, but only accounts with an app role and
                access to these Meta assets can test. Public customers require
                App Review and the listed messaging permissions.
              </p>
            </div>
            <form onSubmit={(event) => void connect(event)}>
              <label htmlFor={`${kind}-asset-id`}>{config.assetLabel}</label>
              <input
                disabled={busy}
                id={`${kind}-asset-id`}
                inputMode="numeric"
                onChange={(event) => setAssetId(event.target.value)}
                placeholder="Numeric account ID"
                required
                value={assetId}
              />
              <label htmlFor={`${kind}-page-token`}>Page access token</label>
              <input
                autoComplete="off"
                disabled={busy}
                id={`${kind}-page-token`}
                onChange={(event) => setPageAccessToken(event.target.value)}
                placeholder="EAA…"
                required
                type={showSecrets ? 'text' : 'password'}
                value={pageAccessToken}
              />
              <label htmlFor={`${kind}-app-secret`}>Meta app secret</label>
              <div className="meta-secret-input">
                <input
                  autoComplete="off"
                  disabled={busy}
                  id={`${kind}-app-secret`}
                  onChange={(event) => setAppSecret(event.target.value)}
                  placeholder="32-character app secret"
                  required
                  type={showSecrets ? 'text' : 'password'}
                  value={appSecret}
                />
                <button
                  aria-label={
                    showSecrets ? 'Hide Meta secrets' : 'Show Meta secrets'
                  }
                  onClick={() => setShowSecrets((current) => !current)}
                  type="button"
                >
                  {showSecrets ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="meta-form-actions">
                <button
                  className="button primary-button"
                  disabled={
                    busy ||
                    !assetId.trim() ||
                    !pageAccessToken.trim() ||
                    !appSecret.trim()
                  }
                  type="submit"
                >
                  {busy ? 'Verifying…' : 'Verify credentials'}
                </button>
                {connected && (
                  <button
                    className="button secondary-button"
                    disabled={busy}
                    onClick={() => setShowCredentials(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          <div className="meta-viewer-empty">
            <ShieldCheck size={20} />
            <p>An owner or admin can connect a development-mode account.</p>
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
            <Check size={14} /> {notice}
          </p>
        )}
      </div>
    </article>
  );
}

function MetaWebhookValue({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return (
    <div className="meta-webhook-value">
      <label>{label}</label>
      <div>
        <code>{value}</code>
        <button onClick={onCopy} type="button">
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

const channelConfig = {
  facebook: {
    assetLabel: 'Facebook Page ID',
    icon: MessagesSquare,
    label: 'Facebook Messenger',
    setupDescription:
      'Use a Facebook Page you manage and a Meta app where your Facebook account has an app role.',
    setupTitle: 'Connect a development Page',
    steps: [
      'Add Messenger to the Meta app and connect your Facebook Page.',
      'Generate a Page access token for that Page in Messenger settings.',
      'Copy the Page ID and the app secret from App settings → Basic.',
      'In development mode, message the Page from a Facebook account assigned to the app.',
    ],
    subscriptionStep: 'Subscribe the Page to the messages webhook field.',
    webhookProduct: 'Messenger',
  },
  instagram: {
    assetLabel: 'Instagram Professional account ID',
    icon: Camera,
    label: 'Instagram',
    setupDescription:
      'The Instagram account must be Professional, connected to a Facebook Page, and controlled by an app-role user.',
    setupTitle: 'Connect a Professional account',
    steps: [
      'Connect the Instagram Professional account to a Facebook Page.',
      'Enable Connected tools in Instagram message-control settings.',
      'Grant instagram_basic, instagram_manage_messages, and pages_manage_metadata.',
      'Use the Page access token and Instagram Professional account ID.',
    ],
    subscriptionStep: 'Subscribe the Instagram account to the messages topic.',
    webhookProduct: 'Instagram',
  },
} as const;

function formatDate(value: string | null | undefined) {
  if (!value) return 'No messages yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
