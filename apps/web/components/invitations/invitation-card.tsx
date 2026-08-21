'use client';

import {
  ArrowRight,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  acceptInvitation,
  previewInvitation,
  type InvitationPreview,
} from '../../lib/team';
import { saveLastWorkspaceId } from '../../lib/product';
import { readSession } from '../../lib/session';

export function InvitationCard({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const nextPath = `/invite/${encodeURIComponent(token)}`;

  useEffect(() => {
    void (async () => {
      try {
        const session = await readSession();
        if (!session) {
          setNeedsSignIn(true);
          return;
        }
        setPreview(await previewInvitation(token));
      } catch (caught: unknown) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to open this invitation.',
        );
      }
    })();
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(undefined);
    try {
      const workspace = await acceptInvitation(token);
      saveLastWorkspaceId(workspace.id);
      router.replace('/app');
      router.refresh();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to accept this invitation.',
      );
      setBusy(false);
    }
  }

  if (!preview && !needsSignIn && !error) {
    return (
      <div className="invitation-card invitation-loading" role="status">
        <LoaderCircle className="spin" size={26} />
        <p>Checking your invitation…</p>
      </div>
    );
  }

  if (needsSignIn) {
    return (
      <div className="invitation-card">
        <span className="invitation-icon">
          <LogIn size={24} />
        </span>
        <p className="eyebrow">Team invitation</p>
        <h1>Sign in to continue.</h1>
        <p>
          Chanda verifies the signed-in email before granting workspace access.
        </p>
        <div className="invitation-actions">
          <Link
            className="button primary-button"
            href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
          >
            Sign in <ArrowRight size={16} />
          </Link>
          <Link
            className="button secondary-button"
            href={`/sign-up?next=${encodeURIComponent(nextPath)}`}
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="invitation-card invitation-error" role="alert">
        <span className="invitation-icon">
          <ShieldCheck size={24} />
        </span>
        <p className="eyebrow">Invitation unavailable</p>
        <h1>This link can’t be accepted.</h1>
        <p>{error}</p>
        <Link className="button secondary-button" href="/app">
          Return to Chanda
        </Link>
      </div>
    );
  }

  return (
    <div className="invitation-card">
      <span className="invitation-icon">
        <UsersRound size={24} />
      </span>
      <p className="eyebrow">You’re invited</p>
      <h1>Join {preview.workspaceName}.</h1>
      <p>
        Continue as <strong>{preview.email}</strong> with the{' '}
        <strong>{preview.role}</strong> role.
      </p>
      <dl>
        <div>
          <dt>Workspace</dt>
          <dd>{preview.workspaceName}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{preview.role}</dd>
        </div>
        <div>
          <dt>Link expires</dt>
          <dd>{new Date(preview.expiresAt).toLocaleString()}</dd>
        </div>
      </dl>
      {error && (
        <p className="form-status error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary-button"
        disabled={busy}
        onClick={() => void accept()}
        type="button"
      >
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <ShieldCheck size={16} />
        )}
        Accept invitation
      </button>
      <p className="invitation-note">
        Access is granted only after this explicit confirmation.
      </p>
    </div>
  );
}
