'use client';

import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Send,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  connectTelegramChannel,
  disconnectTelegramChannel,
  getTelegramChannel,
  type TelegramChannel,
} from '../../lib/channels';
import { ChannelSetupPrompt } from './channel-setup-prompt';

export function TelegramChannelCard({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [channel, setChannel] = useState<TelegramChannel>();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [disconnectArmed, setDisconnectArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setChannel(await getTelegramChannel(workspaceId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load Telegram status.',
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
      const connected = await connectTelegramChannel(workspaceId, token);
      setChannel(connected);
      setToken('');
      setShowToken(false);
      setShowSetup(false);
      setNotice(`@${connected.botUsername} is connected and ready.`);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Telegram setup failed.',
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
      await disconnectTelegramChannel(workspaceId);
      setChannel((current) =>
        current
          ? {
              ...current,
              botFirstName: null,
              botUsername: null,
              status: 'disconnected',
              webhookUrl: null,
            }
          : current,
      );
      setDisconnectArmed(false);
      setShowSetup(false);
      setNotice(
        'Telegram disconnected. Existing conversations remain in the inbox.',
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Disconnect failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!channel && !error) {
    return (
      <article className="channel-card telegram-card telegram-card-loading">
        <RefreshCw className="spin" size={20} /> Checking Telegram…
      </article>
    );
  }

  const connected = channel?.status === 'active' && channel.botUsername;
  const setupVisible = canManage && showSetup;

  return (
    <article className="channel-card telegram-card">
      <header>
        <span className="channel-icon">
          <Send size={21} />
        </span>
        <div>
          <p>Messaging channel</p>
          <h2>{connected ? `@${channel.botUsername}` : 'Telegram'}</h2>
        </div>
        <span className={`channel-readiness ${connected ? 'ready' : 'setup'}`}>
          {connected ? <Check size={14} /> : <ShieldCheck size={14} />}
          {connected ? 'Connected' : 'Needs setup'}
        </span>
      </header>

      <div className="telegram-body">
        {connected && !showSetup ? (
          <div className="telegram-connected">
            <div>
              <strong>{channel.botFirstName}</strong>
              <p>
                Private text messages sent to this bot become Chanda inbox
                tickets. Agent replies are delivered back to the same chat.
              </p>
            </div>
            <dl>
              <div>
                <dt>Webhook</dt>
                <dd>Verified with a private secret</dd>
              </div>
              <div>
                <dt>Last inbound</dt>
                <dd>{formatDate(channel.lastInboundAt)}</dd>
              </div>
              <div>
                <dt>Stored token</dt>
                <dd>Encrypted and write-only</dd>
              </div>
            </dl>
            <div className="telegram-actions">
              <a
                className="button primary-button"
                href={`https://t.me/${channel.botUsername}`}
                rel="noreferrer"
                target="_blank"
              >
                Open bot <ExternalLink size={15} />
              </a>
              {canManage && (
                <button
                  className="button secondary-button"
                  disabled={busy}
                  onClick={() => {
                    setDisconnectArmed(false);
                    setShowSetup(true);
                  }}
                  type="button"
                >
                  Replace token
                </button>
              )}
              {canManage && (
                <button
                  className={`button telegram-disconnect ${
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
        ) : setupVisible ? (
          <div className="telegram-setup">
            <div className="telegram-guide">
              <div>
                <span>1</span>
                <p>
                  Open{' '}
                  <a
                    href="https://t.me/BotFather"
                    rel="noreferrer"
                    target="_blank"
                  >
                    @BotFather <ExternalLink size={12} />
                  </a>{' '}
                  in Telegram.
                </p>
              </div>
              <div>
                <span>2</span>
                <p>
                  Send <code>/newbot</code>, choose a display name, then a
                  username ending in <code>bot</code>.
                </p>
              </div>
              <div>
                <span>3</span>
                <p>
                  Copy the HTTP API token BotFather returns and paste it below.
                  Chanda verifies the bot before saving it.
                </p>
              </div>
              <div>
                <span>4</span>
                <p>
                  After connecting, open the bot and send a private text
                  message. It will appear in the Inbox.
                </p>
              </div>
            </div>

            <form onSubmit={(event) => void connect(event)}>
              <label htmlFor="telegram-token">
                <KeyRound size={15} /> Bot token
              </label>
              <div className="telegram-token-input">
                <input
                  autoComplete="off"
                  disabled={busy}
                  id="telegram-token"
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="123456789:AA…"
                  required
                  type={showToken ? 'text' : 'password'}
                  value={token}
                />
                <button
                  aria-label={showToken ? 'Hide bot token' : 'Show bot token'}
                  onClick={() => setShowToken((current) => !current)}
                  type="button"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p>
                Treat this token like a password. It is never shown again after
                connection. Revoke a leaked token with <code>/revoke</code> in
                BotFather, then replace it here.
              </p>
              <div className="telegram-actions">
                <button
                  className="button primary-button"
                  disabled={busy || !token.trim()}
                  type="submit"
                >
                  {busy ? 'Verifying bot…' : 'Verify and connect'}
                </button>
                <button
                  className="button secondary-button"
                  disabled={busy}
                  onClick={() => {
                    setToken('');
                    setShowSetup(false);
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : canManage ? (
          <ChannelSetupPrompt
            actionLabel="Set up Telegram"
            description="Connect a BotFather token to receive private customer messages."
            onAction={() => setShowSetup(true)}
            title="Connect Telegram"
          />
        ) : (
          <div className="telegram-viewer-empty">
            <ShieldCheck size={22} />
            <div>
              <strong>Telegram is not connected</strong>
              <p>A workspace owner or admin can connect a BotFather token.</p>
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

function formatDate(value: string | null) {
  if (!value) return 'No messages yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
