'use client';

import { ArrowRight, Building2, Check, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { Brand } from '../brand';
import {
  createWorkspace,
  listWorkspaces,
  readSupplineSession,
} from '../../lib/session';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function WorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void (async () => {
      try {
        const session = await readSupplineSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }
        const workspaces = await listWorkspaces();
        if (workspaces.length > 0) {
          router.replace('/app');
          return;
        }
        setReady(true);
      } catch (caught: unknown) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load onboarding.',
        );
        setReady(true);
      }
    })();
  }, [router]);

  function updateName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(toSlug(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await createWorkspace({ name: name.trim(), slug });
      router.replace('/app');
      router.refresh();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to create the workspace.',
      );
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="route-loader">
        <span className="brand-mark" />
        <p>Preparing your workspace…</p>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <header>
        <Brand />
        <span>Step 1 of 3</span>
      </header>
      <div className="onboarding-grid">
        <section className="onboarding-copy">
          <p className="eyebrow">Your support home</p>
          <h1>Name the place where your team works.</h1>
          <p>
            This workspace keeps customer conversations, knowledge, teammates,
            and reporting isolated from every other organization.
          </p>
          <ul>
            <li>
              <Check size={16} />
              You’ll be the workspace owner
            </li>
            <li>
              <Check size={16} />
              Invite teammates after setup
            </li>
            <li>
              <LockKeyhole size={16} />
              Your data stays workspace-scoped
            </li>
          </ul>
        </section>
        <section className="onboarding-card">
          <span className="form-icon">
            <Building2 size={22} />
          </span>
          <h2>Create your workspace</h2>
          <p>You can change the display name later.</p>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Workspace name
              <input
                autoFocus
                maxLength={80}
                minLength={2}
                onChange={(event) => updateName(event.target.value)}
                placeholder="Acme Support"
                required
                value={name}
              />
            </label>
            <label>
              Workspace URL
              <span className="slug-input">
                <span>suppline.ai/</span>
                <input
                  maxLength={48}
                  minLength={2}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setSlug(toSlug(event.target.value));
                  }}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                  value={slug}
                />
              </span>
            </label>
            {error && (
              <p className="form-status error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary-button"
              disabled={busy || slug.length < 2}
              type="submit"
            >
              {busy ? 'Creating…' : 'Create workspace'}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
