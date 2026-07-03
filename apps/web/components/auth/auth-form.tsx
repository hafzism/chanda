'use client';

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { firebaseAuth } from '../../lib/firebase';
import { createSupplineSession } from '../../lib/session';

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up';
}

function friendlyAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'We could not complete that request. Please try again.';
  }

  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
    'auth/popup-blocked': 'Allow pop-ups to continue with Google.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/weak-password': 'Use a password with at least 8 characters.',
  };
  const code = Object.keys(messages).find((key) => error.message.includes(key));

  if (code) {
    return messages[code] ?? error.message;
  }

  if (error.message.includes('configuration is unavailable')) {
    return 'Sign-in is temporarily unavailable. Please contact support.';
  }

  return error.message;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<
    { kind: 'error' | 'success'; message: string } | undefined
  >();
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState('/app');
  const isSignUp = mode === 'sign-up';

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('next');
    if (requested?.startsWith('/') && !requested.startsWith('//')) {
      setNextPath(requested);
    }
  }, []);

  async function completeSignIn(
    user: Parameters<typeof createSupplineSession>[0],
  ) {
    await createSupplineSession(user);
    router.replace(nextPath);
    router.refresh();
  }

  async function continueWithGoogle() {
    setBusy(true);
    setStatus(undefined);

    try {
      const result = await signInWithPopup(
        firebaseAuth(),
        new GoogleAuthProvider(),
      );
      await completeSignIn(result.user);
    } catch (error: unknown) {
      setStatus({ kind: 'error', message: friendlyAuthError(error) });
      setBusy(false);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(undefined);

    try {
      const auth = firebaseAuth();

      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        await sendEmailVerification(result.user);
        await signOut(auth);
        setStatus({
          kind: 'success',
          message:
            'Check your inbox to verify your email, then return here to sign in.',
        });
        setBusy(false);
        return;
      }

      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await completeSignIn(result.user);
    } catch (error: unknown) {
      setStatus({ kind: 'error', message: friendlyAuthError(error) });
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <p className="eyebrow">
          {isSignUp ? 'Create your workspace' : 'Welcome back'}
        </p>
        <h1>
          {isSignUp ? 'Start supporting with clarity.' : 'Sign in to Suppline.'}
        </h1>
        <p>
          {isSignUp
            ? 'Bring your knowledge and customer conversations into one calm operating space.'
            : 'Your support workspace, knowledge, and customer conversations are waiting.'}
        </p>
      </div>

      <button
        className="button google-button"
        disabled={busy}
        onClick={() => void continueWithGoogle()}
        type="button"
      >
        <span className="google-g" aria-hidden="true">
          G
        </span>
        Continue with Google
      </button>

      <div className="auth-divider">
        <span>or continue with email</span>
      </div>

      <form className="auth-form" onSubmit={(event) => void submitEmail(event)}>
        <label>
          Work email
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          <span className="label-row">
            Password
            {!isSignUp && <Link href="/forgot-password">Forgot password?</Link>}
          </span>
          <span className="password-field">
            <input
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        {status && (
          <p className={`form-status ${status.kind}`} role="status">
            {status.message}
          </p>
        )}

        <button className="button primary-button" disabled={busy} type="submit">
          {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>

      <p className="auth-switch">
        {isSignUp ? 'Already have an account?' : 'New to Suppline AI?'}{' '}
        <Link
          href={`${isSignUp ? '/sign-in' : '/sign-up'}${nextPath === '/app' ? '' : `?next=${encodeURIComponent(nextPath)}`}`}
        >
          {isSignUp ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </div>
  );
}
