import {
  loadWidgetSession,
  saveWidgetSession,
  WidgetApiClient,
  type WidgetMessage,
  type WidgetSession,
  type WidgetStorage,
} from './widget-client';

const POLL_INTERVAL_MS = 5_000;
const fallbackStorageValues = new Map<string, string>();

export class SupplineWidgetElement extends HTMLElement {
  private api?: WidgetApiClient;
  private draftMessageId: string | undefined;
  private messages: WidgetMessage[] = [];
  private opened = false;
  private polling = false;
  private pollTimer: number | undefined;
  private session?: WidgetSession;
  private storage?: WidgetStorage;

  connectedCallback(): void {
    const publicKey = this.getAttribute('public-key') ?? '';
    const apiOrigin = this.getAttribute('api-origin') ?? window.location.origin;
    if (!/^pub_[A-Za-z0-9_-]{24,64}$/.test(publicKey)) {
      console.error('Suppline widget requires a valid public-key attribute.');
      return;
    }

    this.storage = availableStorage();
    this.session = loadWidgetSession(publicKey, this.storage);
    this.api = new WidgetApiClient(apiOrigin.replace(/\/$/, ''), publicKey);
    this.attachShadow({ mode: 'open' }).innerHTML = template(
      this.getAttribute('title') ?? 'How can we help?',
      this.getAttribute('position') === 'left' ? 'left' : 'right',
    );
    this.bindEvents();
    this.updateMessages();
  }

  disconnectedCallback(): void {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
  }

  private bindEvents(): void {
    this.element<HTMLButtonElement>('[data-launcher]').addEventListener(
      'click',
      () => this.toggle(),
    );
    this.element<HTMLButtonElement>('[data-close]').addEventListener(
      'click',
      () => this.close(),
    );
    this.element<HTMLFormElement>('form').addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        void this.send();
      },
    );
    this.element<HTMLTextAreaElement>('textarea').addEventListener(
      'input',
      () => {
        this.draftMessageId = undefined;
        this.updateSendButton();
      },
    );
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.opened) this.close();
    });
    this.pollTimer = window.setInterval(() => {
      if (this.opened) void this.readMessages();
    }, POLL_INTERVAL_MS);
  }

  private toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  private open(): void {
    this.opened = true;
    this.element<HTMLElement>('[data-panel]').hidden = false;
    const launcher = this.element<HTMLButtonElement>('[data-launcher]');
    launcher.setAttribute('aria-expanded', 'true');
    this.element<HTMLTextAreaElement>('textarea').focus();
    if (this.session?.hasConversation) void this.readMessages();
  }

  private close(): void {
    this.opened = false;
    this.element<HTMLElement>('[data-panel]').hidden = true;
    const launcher = this.element<HTMLButtonElement>('[data-launcher]');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  private async send(): Promise<void> {
    if (!this.api || !this.session || !this.storage) return;
    const input = this.element<HTMLTextAreaElement>('textarea');
    const body = input.value.trim();
    if (!body) return;
    const button = this.element<HTMLButtonElement>('[data-send]');
    button.disabled = true;
    this.setStatus('Sending…', false);
    this.draftMessageId ??= crypto.randomUUID();
    try {
      await this.api.sendMessage(this.session, body, this.draftMessageId);
      this.session.hasConversation = true;
      saveWidgetSession(
        this.getAttribute('public-key') ?? '',
        this.storage,
        this.session,
      );
      input.value = '';
      this.draftMessageId = undefined;
      await this.readMessages();
      this.setStatus('Message sent', false);
    } catch (error: unknown) {
      this.setStatus(
        error instanceof Error ? error.message : 'Unable to send your message.',
        true,
      );
    } finally {
      this.updateSendButton();
    }
  }

  private async readMessages(): Promise<void> {
    if (!this.api || !this.session?.hasConversation || this.polling) return;
    this.polling = true;
    try {
      const messages = await this.api.readMessages(this.session);
      if (
        messages.length !== this.messages.length ||
        messages.at(-1)?.id !== this.messages.at(-1)?.id
      ) {
        this.messages = messages;
        this.updateMessages();
      }
    } catch (error: unknown) {
      this.setStatus(
        error instanceof Error
          ? error.message
          : 'Unable to refresh the conversation.',
        true,
      );
    } finally {
      this.polling = false;
    }
  }

  private updateMessages(): void {
    const thread = this.element<HTMLElement>('[data-messages]');
    thread.replaceChildren();
    if (this.messages.length === 0) {
      const welcome = document.createElement('div');
      welcome.className = 'welcome';
      welcome.innerHTML =
        '<strong>Welcome</strong><p>Send us a message and our support team will get back to you here.</p>';
      thread.append(welcome);
      return;
    }
    for (const message of this.messages) {
      const row = document.createElement('div');
      row.className = `message ${message.direction}`;
      const bubble = document.createElement('div');
      const author = document.createElement('span');
      author.textContent =
        message.direction === 'inbound' ? 'You' : authorLabel(message);
      const body = document.createElement('p');
      body.textContent = message.body;
      const time = document.createElement('time');
      time.dateTime = message.occurredAt;
      time.textContent = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(message.occurredAt));
      bubble.append(author, body, time);
      row.append(bubble);
      thread.append(row);
    }
    thread.scrollTop = thread.scrollHeight;
  }

  private updateSendButton(): void {
    const input = this.element<HTMLTextAreaElement>('textarea');
    this.element<HTMLButtonElement>('[data-send]').disabled =
      input.value.trim().length === 0;
  }

  private setStatus(message: string, error: boolean): void {
    const status = this.element<HTMLElement>('[data-status]');
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  private element<T extends Element>(selector: string): T {
    const element = this.shadowRoot?.querySelector<T>(selector);
    if (!element) throw new Error(`Widget element not found: ${selector}`);
    return element;
  }
}

function authorLabel(message: WidgetMessage): string {
  if (message.authorKind === 'ai') return 'Suppline AI';
  if (message.authorKind === 'agent') return 'Support';
  return 'Update';
}

function template(title: string, position: 'left' | 'right'): string {
  return `
    <style>${styles}</style>
    <div class="root ${position}">
      <section aria-label="Customer support chat" class="panel" data-panel hidden id="suppline-panel">
        <header>
          <span class="placeholder-mark" aria-hidden="true">S</span>
          <div><strong>${escapeHtml(title)}</strong><span>Suppline AI support</span></div>
          <button aria-label="Close support chat" data-close type="button">×</button>
        </header>
        <div aria-live="polite" class="messages" data-messages></div>
        <form>
          <label for="suppline-message">Message</label>
          <textarea id="suppline-message" maxlength="4000" placeholder="Write your message…" rows="2"></textarea>
          <div class="composer-footer">
            <span aria-live="polite" data-status></span>
            <button data-send disabled type="submit">Send</button>
          </div>
        </form>
        <footer>Powered by Suppline AI</footer>
      </section>
      <button aria-controls="suppline-panel" aria-expanded="false" aria-label="Open support chat" class="launcher" data-launcher type="button">
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4.8 4v-4.1A2.5 2.5 0 0 1 5 12.5v-6Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8"/></svg>
      </button>
    </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const styles = `
  :host { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  button, textarea { font: inherit; }
  .root { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 2147483000; color: #34241d; }
  .root.left { right: auto; left: 1.25rem; }
  .panel { width: min(23rem, calc(100vw - 2rem)); height: min(36rem, calc(100vh - 6rem)); margin-bottom: .8rem; overflow: hidden; border: 1px solid #d9c9be; border-radius: .85rem; background: #fffdf9; box-shadow: 0 1.2rem 3rem rgb(51 34 25 / 20%); }
  header { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: .7rem; align-items: center; min-height: 4.35rem; border-bottom: 1px solid #dfd2c9; background: #f2e5db; padding: .75rem; }
  .placeholder-mark { display: grid; width: 2.35rem; height: 2.35rem; place-items: center; border-radius: .55rem; background: #bf5b35; color: white; font-family: Georgia, serif; font-size: 1.1rem; font-weight: 700; }
  header div { display: grid; gap: .12rem; min-width: 0; }
  header strong { overflow: hidden; font-family: Georgia, serif; font-size: .9rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  header span { color: #745f54; font-size: .66rem; }
  header button { display: grid; width: 2rem; height: 2rem; place-items: center; border: 0; border-radius: .4rem; background: transparent; color: #745f54; font-size: 1.4rem; cursor: pointer; }
  header button:hover, header button:focus-visible { background: #e6d2c3; color: #34241d; outline: none; }
  .messages { height: calc(100% - 12.15rem); overflow-y: auto; background: #fbf7f2; padding: 1rem; scrollbar-color: #cbb6a8 transparent; }
  .welcome { margin: 2.5rem auto; max-width: 15rem; text-align: center; }
  .welcome strong { font-family: Georgia, serif; font-size: 1.1rem; }
  .welcome p { margin: .5rem 0 0; color: #745f54; font-size: .72rem; line-height: 1.55; }
  .message { display: flex; margin-bottom: .75rem; justify-content: flex-end; }
  .message.outbound { justify-content: flex-start; }
  .message > div { max-width: 82%; border: 1px solid #cd9c86; border-radius: .7rem .7rem .15rem; background: #f2d9cc; padding: .6rem .7rem; }
  .message.outbound > div { border-color: #d9c9be; border-radius: .7rem .7rem .7rem .15rem; background: #fffdf9; }
  .message span { color: #8a4229; font-size: .56rem; font-weight: 800; text-transform: uppercase; }
  .message p { margin: .24rem 0; font-size: .72rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .message time { color: #806e64; font-size: .54rem; }
  form { height: 6.25rem; border-top: 1px solid #dfd2c9; background: #fffdf9; padding: .55rem .65rem; }
  form label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  textarea { display: block; width: 100%; height: 2.75rem; resize: none; border: 0; outline: 0; background: transparent; color: #34241d; font-size: .72rem; line-height: 1.45; }
  textarea::placeholder { color: #9a887e; }
  .composer-footer { display: flex; min-height: 2rem; gap: .5rem; align-items: center; justify-content: space-between; }
  .composer-footer span { overflow: hidden; color: #745f54; font-size: .58rem; text-overflow: ellipsis; white-space: nowrap; }
  .composer-footer span.error { color: #a43c2d; }
  .composer-footer button { border: 0; border-radius: .42rem; background: #bf5b35; padding: .44rem .78rem; color: white; font-size: .66rem; font-weight: 750; cursor: pointer; }
  .composer-footer button:hover { background: #9e4528; }
  .composer-footer button:focus-visible, .launcher:focus-visible { outline: 3px solid #e2a98d; outline-offset: 2px; }
  .composer-footer button:disabled { cursor: not-allowed; opacity: .48; }
  .panel > footer { display: grid; height: 1.55rem; place-items: center; border-top: 1px solid #eee4dd; color: #8a776c; font-size: .54rem; }
  .launcher { display: grid; width: 3.4rem; height: 3.4rem; margin-left: auto; place-items: center; border: 1px solid #9e4528; border-radius: 50%; background: #bf5b35; color: white; box-shadow: 0 .7rem 1.5rem rgb(76 39 24 / 24%); cursor: pointer; }
  .left .launcher { margin-right: auto; margin-left: 0; }
  .launcher:hover { background: #9e4528; }
  .launcher svg { width: 1.55rem; height: 1.55rem; }
  @media (max-width: 30rem) { .root, .root.left { right: 1rem; bottom: 1rem; left: 1rem; } .panel { width: 100%; height: calc(100vh - 5.5rem); } }
  @media (prefers-reduced-motion: no-preference) { .panel { animation: enter .16s ease-out; transform-origin: bottom right; } @keyframes enter { from { opacity: 0; transform: translateY(.5rem) scale(.98); } } }
`;

function availableStorage(): WidgetStorage {
  try {
    const storage = window.localStorage;
    const probe = 'suppline:storage-probe';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return {
      getItem: (key) => fallbackStorageValues.get(key) ?? null,
      setItem: (key, value) => fallbackStorageValues.set(key, value),
    };
  }
}
