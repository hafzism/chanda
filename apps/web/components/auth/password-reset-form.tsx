'use client';

import { sendPasswordResetEmail } from 'firebase/auth';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { firebaseAuth } from '../../lib/firebase';

export function PasswordResetForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);

    try {
      await sendPasswordResetEmail(firebaseAuth(), email.trim());
      setMessage(
        'If an account exists for that address, a reset link is on its way.',
      );
    } catch {
      setMessage(
        'If an account exists for that address, a reset link is on its way.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <Link className="back-link" href="/sign-in">
        <ArrowLeft size={16} />
        Back to sign in
      </Link>
      <div className="auth-heading">
        <p className="eyebrow">Password recovery</p>
        <h1>Find your way back in.</h1>
        <p>Enter your work email and we’ll send a secure reset link.</p>
      </div>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
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
        {message && (
          <p className="form-status success" role="status">
            {message}
          </p>
        )}
        <button className="button primary-button" disabled={busy} type="submit">
          {busy ? 'Sending…' : 'Send reset link'}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>
    </div>
  );
}
