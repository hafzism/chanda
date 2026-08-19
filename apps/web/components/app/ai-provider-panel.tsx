'use client';

import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import {
  configureAiProvider,
  readAiProvider,
  removeAiProvider,
  type AiProvider,
  type AiProviderSummary,
} from '../../lib/ai-provider';

const providerOptions: ReadonlyArray<{
  description: string;
  label: string;
  value: AiProvider;
}> = [
  {
    description: 'GPT-5.6 Luna and text-embedding-3-small',
    label: 'OpenAI',
    value: 'openai',
  },
  {
    description: 'Gemini 3.6 Flash and Gemini Embedding 2',
    label: 'Google Gemini',
    value: 'google-gemini',
  },
];

function providerLabel(provider: AiProvider | null): string {
  return (
    providerOptions.find((option) => option.value === provider)?.label ??
    'Not connected'
  );
}

export function AiProviderPanel({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [summary, setSummary] = useState<AiProviderSummary>();
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  useEffect(() => {
    let active = true;
    setSummary(undefined);
    setError(undefined);

    void readAiProvider(workspaceId)
      .then((nextSummary) => {
        if (!active) return;
        setSummary(nextSummary);
        if (nextSummary.provider) setProvider(nextSummary.provider);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load the AI provider.',
        );
      });

    return () => {
      active = false;
    };
  }, [workspaceId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const nextSummary = await configureAiProvider(workspaceId, {
        apiKey: apiKey.trim(),
        provider,
      });
      setSummary(nextSummary);
      setApiKey('');
      setNotice('Provider connected. Knowledge reindexing has been queued.');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to validate this API key.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await removeAiProvider(workspaceId);
      setSummary({
        configured: false,
        embeddingDimensions: null,
        embeddingModel: null,
        generationModel: null,
        provider: null,
        updatedAt: null,
        validatedAt: null,
      });
      setConfirmRemoval(false);
      setNotice(
        'Provider removed. Existing knowledge remains available by keyword.',
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to remove the AI provider.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!summary && !error) {
    return (
      <section className="panel-state" aria-live="polite">
        <LoaderCircle aria-hidden="true" className="spin" size={22} />
        <span>Loading provider…</span>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="panel-state panel-state-error" role="alert">
        <p>{error}</p>
        <button
          className="button secondary-button"
          onClick={() => window.location.reload()}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="ai-provider-layout" aria-labelledby="ai-provider-title">
      <article className="settings-card ai-provider-summary">
        <div className="section-icon" aria-hidden="true">
          <KeyRound size={20} />
        </div>
        <div>
          <p className="eyebrow">Workspace credential</p>
          <h2 id="ai-provider-title">{providerLabel(summary.provider)}</h2>
          <p>
            {summary.configured
              ? 'Connected and validated for this workspace.'
              : 'Connect one provider to enable grounded AI drafts and semantic search.'}
          </p>
        </div>
        {summary.configured && (
          <dl className="provider-details">
            <div>
              <dt>Draft model</dt>
              <dd>{summary.generationModel}</dd>
            </div>
            <div>
              <dt>Embedding model</dt>
              <dd>{summary.embeddingModel}</dd>
            </div>
            <div>
              <dt>Validated</dt>
              <dd>
                {summary.validatedAt
                  ? new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                    }).format(new Date(summary.validatedAt))
                  : '—'}
              </dd>
            </div>
          </dl>
        )}
      </article>

      <article className="settings-card ai-provider-form-card">
        <header>
          <div>
            <h2>
              {summary.configured ? 'Replace API key' : 'Connect a provider'}
            </h2>
            <p>
              The key is validated, encrypted, and never returned by the API.
            </p>
          </div>
          <ShieldCheck aria-hidden="true" size={21} />
        </header>

        {!canManage ? (
          <p className="permission-note">
            An owner or admin can manage this credential.
          </p>
        ) : (
          <form onSubmit={(event) => void save(event)}>
            <fieldset disabled={busy}>
              <legend>Provider</legend>
              <div className="provider-options">
                {providerOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      checked={provider === option.value}
                      name="provider"
                      onChange={() => setProvider(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    {provider === option.value && (
                      <CheckCircle2 aria-hidden="true" size={18} />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field-label" htmlFor="workspace-ai-api-key">
              API key
            </label>
            <input
              aria-describedby="workspace-ai-api-key-help"
              autoComplete="new-password"
              disabled={busy}
              id="workspace-ai-api-key"
              minLength={16}
              name="apiKey"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={provider === 'openai' ? 'sk-…' : 'AIza…'}
              required
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="field-help" id="workspace-ai-api-key-help">
              Use a restricted project key where your provider supports it.
            </p>

            <div className="settings-actions">
              <button
                className="button primary-button"
                disabled={busy || apiKey.trim().length < 16}
                type="submit"
              >
                {busy ? 'Validating…' : 'Validate and save'}
              </button>
              {summary.configured && !confirmRemoval && (
                <button
                  className="button danger-button"
                  disabled={busy}
                  onClick={() => setConfirmRemoval(true)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={16} /> Remove key
                </button>
              )}
            </div>

            {confirmRemoval && (
              <div
                className="remove-confirmation"
                role="group"
                aria-label="Confirm provider removal"
              >
                <p>
                  Remove this key? AI drafting and semantic search will stop.
                </p>
                <div>
                  <button
                    className="button danger-button"
                    disabled={busy}
                    onClick={() => void remove()}
                    type="button"
                  >
                    {busy ? 'Removing…' : 'Remove'}
                  </button>
                  <button
                    className="button secondary-button"
                    disabled={busy}
                    onClick={() => setConfirmRemoval(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {error && (
          <p className="form-status error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="form-status success" role="status">
            {notice}
          </p>
        )}
      </article>
    </section>
  );
}
