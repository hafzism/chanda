'use client';

import {
  Check,
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  connectWhatsAppChannel,
  disconnectWhatsAppChannel,
  getWhatsAppChannel,
  type WhatsAppChannel,
} from '../../lib/channels';

export function WhatsAppChannelCard({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [channel, setChannel] = useState<WhatsAppChannel>();
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
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
      setChannel(await getWhatsAppChannel(workspaceId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load WhatsApp status.',
      );
    }
  }, [workspaceId]);

  useEffect(() => void load(), [load]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const connected = await connectWhatsAppChannel(workspaceId, {
        accessToken,
        appSecret,
        phoneNumberId,
      });
      setChannel(connected);
      setAccessToken('');
      setAppSecret('');
      setPhoneNumberId('');
      setShowSecrets(false);
      setShowCredentials(false);
      setNotice(
        'Credentials verified. Copy the callback URL and one-time verify token into Meta to finish the webhook.',
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'WhatsApp setup failed.',
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
      await disconnectWhatsAppChannel(workspaceId);
      await load();
      setDisconnectArmed(false);
      setShowCredentials(false);
      setNotice(
        'WhatsApp disconnected locally. Remove the callback or messages subscription in Meta if this app will not be reused.',
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Disconnect failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, kind: 'token' | 'url') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(undefined), 1_800);
    } catch {
      setError(
        'Your browser blocked clipboard access. Select the value manually.',
      );
    }
  }

  if (!channel && !error) {
    return (
      <article className="channel-card whatsapp-card whatsapp-card-loading">
        <RefreshCw className="spin" size={20} /> Checking WhatsApp…
      </article>
    );
  }

  const connected = Boolean(
    channel?.id && channel.status !== 'disconnected' && channel.phoneNumberId,
  );
  const webhookReady = Boolean(channel?.webhookVerifiedAt);

  return (
    <article className="channel-card whatsapp-card">
      <header>
        <span className="channel-icon">
          <MessageCircle size={21} />
        </span>
        <div>
          <p>Messaging channel</p>
          <h2>{connected ? channel?.verifiedName : 'WhatsApp'}</h2>
        </div>
        <span
          className={`channel-readiness ${webhookReady ? 'ready' : 'setup'}`}
        >
          {webhookReady ? <Check size={14} /> : <ShieldCheck size={14} />}
          {webhookReady
            ? 'Webhook verified'
            : connected
              ? 'Finish webhook'
              : 'Needs setup'}
        </span>
      </header>

      <div className="whatsapp-body">
        {connected && !showCredentials ? (
          <div className="whatsapp-connected">
            <div className="whatsapp-summary">
              <div>
                <strong>
                  {channel?.displayPhoneNumber} · {channel?.verifiedName}
                </strong>
                <p>
                  Private text messages become inbox tickets. Suppline accepts
                  Meta-signed webhooks and tracks sent, delivered, read, and
                  failed acknowledgements.
                </p>
              </div>
              <span className={webhookReady ? 'verified' : 'pending'}>
                {webhookReady
                  ? 'Receiving messages'
                  : 'Awaiting Meta verification'}
              </span>
            </div>

            {!webhookReady && (
              <div className="whatsapp-webhook-setup">
                <h3>Finish webhook setup in Meta</h3>
                <ol>
                  <li>Open WhatsApp → Configuration in your Meta app.</li>
                  <li>
                    Paste the callback URL and verify token below, then verify.
                  </li>
                  <li>
                    Under Webhook fields, subscribe to <code>messages</code>.
                  </li>
                </ol>
                <WebhookValue
                  copied={copied === 'url'}
                  label="Callback URL"
                  onCopy={() => {
                    if (channel?.webhookUrl)
                      void copy(channel.webhookUrl, 'url');
                  }}
                  value={channel?.webhookUrl ?? ''}
                />
                {channel?.verifyToken ? (
                  <WebhookValue
                    copied={copied === 'token'}
                    label="One-time verify token"
                    onCopy={() => {
                      if (channel.verifyToken)
                        void copy(channel.verifyToken, 'token');
                    }}
                    value={channel.verifyToken}
                  />
                ) : (
                  <p className="whatsapp-token-lost">
                    The verify token was shown only after credential
                    verification. Replace credentials to generate a new one if
                    it was not saved in Meta.
                  </p>
                )}
                <button
                  className="button secondary-button"
                  disabled={busy}
                  onClick={() => void load()}
                  type="button"
                >
                  <RefreshCw size={15} /> Recheck webhook
                </button>
              </div>
            )}

            {webhookReady && (
              <div className="whatsapp-operating-note">
                <ShieldCheck size={18} />
                <p>
                  Free-form replies are available for 24 hours after the
                  customer's latest message. After that, WhatsApp requires an
                  approved template; Suppline blocks the reply with an exact
                  explanation.
                </p>
              </div>
            )}

            <dl>
              <div>
                <dt>Phone number ID</dt>
                <dd>{channel?.phoneNumberId}</dd>
              </div>
              <div>
                <dt>Last inbound</dt>
                <dd>{formatDate(channel?.lastInboundAt)}</dd>
              </div>
              <div>
                <dt>Credentials</dt>
                <dd>Encrypted and write-only</dd>
              </div>
            </dl>

            <div className="whatsapp-actions">
              <a
                className="button secondary-button"
                href="https://developers.facebook.com/apps/"
                rel="noreferrer"
                target="_blank"
              >
                Open Meta app <ExternalLink size={14} />
              </a>
              {canManage && (
                <button
                  className="button secondary-button"
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
                  className={`button whatsapp-disconnect ${
                    disconnectArmed ? 'armed' : ''
                  }`}
                  disabled={busy}
                  onBlur={() => setDisconnectArmed(false)}
                  onClick={() => void disconnect()}
                  type="button"
                >
                  <Unplug size={15} />
                  {disconnectArmed ? 'Confirm disconnect' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>
        ) : canManage ? (
          <div className="whatsapp-setup">
            <div className="whatsapp-guide">
              <div className="whatsapp-guide-heading">
                <div>
                  <strong>Use Meta's free test sender</strong>
                  <p>
                    The test phone number and temporary token are enough for a
                    portfolio demo. No card or production business number is
                    needed.
                  </p>
                </div>
                <a
                  href="https://developers.facebook.com/apps/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Meta Apps <ExternalLink size={13} />
                </a>
              </div>
              <ol>
                <li>Create a Meta app with the Business use case.</li>
                <li>Add WhatsApp, then open WhatsApp → API Setup.</li>
                <li>
                  Add your personal WhatsApp number as a test recipient and send
                  Meta's sample message once. Replying opens the 24-hour service
                  window.
                </li>
                <li>
                  Copy the temporary access token and Phone number ID. Copy App
                  secret from App settings → Basic.
                </li>
              </ol>
              <p className="whatsapp-expiry-note">
                Temporary Meta tokens usually expire quickly. Replace the token
                here when Meta issues another one; use a system-user token only
                for a longer-running deployment.
              </p>
            </div>

            <form onSubmit={(event) => void connect(event)}>
              <label htmlFor="whatsapp-phone-id">Phone number ID</label>
              <input
                autoComplete="off"
                disabled={busy}
                id="whatsapp-phone-id"
                inputMode="numeric"
                onChange={(event) => setPhoneNumberId(event.target.value)}
                placeholder="123456789012345"
                required
                value={phoneNumberId}
              />
              <label htmlFor="whatsapp-access-token">
                Temporary access token
              </label>
              <div className="whatsapp-secret-input">
                <input
                  autoComplete="off"
                  disabled={busy}
                  id="whatsapp-access-token"
                  onChange={(event) => setAccessToken(event.target.value)}
                  placeholder="EAA…"
                  required
                  type={showSecrets ? 'text' : 'password'}
                  value={accessToken}
                />
              </div>
              <label htmlFor="whatsapp-app-secret">Meta app secret</label>
              <div className="whatsapp-secret-input">
                <input
                  autoComplete="off"
                  disabled={busy}
                  id="whatsapp-app-secret"
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
                  {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p>
                Suppline verifies the phone through Meta before encrypting these
                credentials. They are never returned by the API.
              </p>
              <div className="whatsapp-actions">
                <button
                  className="button primary-button"
                  disabled={
                    busy ||
                    !phoneNumberId.trim() ||
                    !accessToken.trim() ||
                    !appSecret.trim()
                  }
                  type="submit"
                >
                  {busy ? 'Verifying with Meta…' : 'Verify credentials'}
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
          <div className="telegram-viewer-empty">
            <ShieldCheck size={22} />
            <div>
              <strong>WhatsApp is not connected</strong>
              <p>
                An owner or admin can connect Meta's development test sender.
              </p>
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

function WebhookValue({
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
    <div className="whatsapp-webhook-value">
      <label>{label}</label>
      <div>
        <code>{value}</code>
        <button onClick={onCopy} type="button">
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No messages yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
