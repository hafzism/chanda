'use client';

import { Check, CreditCard, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  openBillingPortal,
  readBilling,
  startCheckout,
  type BillingSummary,
} from '../../lib/billing';

export function BillingPanel({
  isOwner,
  workspaceId,
}: {
  isOwner: boolean;
  workspaceId: string;
}) {
  const [summary, setSummary] = useState<BillingSummary>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const checkout =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('checkout');

  async function load() {
    setError(undefined);
    try {
      setSummary(await readBilling(workspaceId));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load billing.',
      );
    }
  }

  useEffect(() => {
    void load();
  }, [workspaceId]);

  async function redirect(action: () => Promise<{ url: string }>) {
    setBusy(true);
    setError(undefined);
    try {
      window.location.assign((await action()).url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to open Stripe.',
      );
      setBusy(false);
    }
  }

  if (!summary && !error)
    return (
      <section className="billing-state" aria-live="polite">
        Loading billing…
      </section>
    );
  if (!summary)
    return (
      <section className="billing-state error-state">
        <p>{error}</p>
        <button className="button secondary-button" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );

  const pro = summary.entitlement === 'pro';
  return (
    <section className="billing-layout">
      {checkout === 'processing' && (
        <div className="billing-notice" role="status">
          Payment submitted. Pro activates after Stripe confirms the
          subscription; refresh shortly if it is still processing.
        </div>
      )}
      {checkout === 'canceled' && (
        <div className="billing-notice neutral" role="status">
          Checkout was canceled. Your current plan has not changed.
        </div>
      )}
      {error && (
        <div className="billing-notice error-state" role="alert">
          {error}
        </div>
      )}
      <article className="billing-plan-card">
        <div className="billing-plan-heading">
          <span>
            <CreditCard size={20} />
          </span>
          <div>
            <p className="eyebrow">Current plan</p>
            <h2>{pro ? 'Pro' : 'Free'}</h2>
          </div>
        </div>
        <p>
          {pro
            ? 'Your workspace has an active Stripe-backed Pro entitlement.'
            : 'Your workspace is using the free plan.'}
        </p>
        {summary.currentPeriodEnd && (
          <div className="billing-period">
            <p>
              {summary.cancelAtPeriodEnd
                ? 'Access ends'
                : 'Current period renews'}{' '}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
              }).format(new Date(summary.currentPeriodEnd))}
              .
            </p>
            {summary.graceEndsAt && summary.status === 'past_due' && (
              <p className="billing-notice neutral">
                Payment needs attention. Pro remains available until{' '}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                }).format(new Date(summary.graceEndsAt))}
                .
              </p>
            )}
          </div>
        )}
        {!isOwner && (
          <p className="billing-permission">
            Only the workspace owner can change billing. You can still see the
            current entitlement.
          </p>
        )}
        {isOwner && (pro || summary.status !== 'free') ? (
          <button
            className="button primary-button"
            disabled={busy}
            onClick={() => void redirect(() => openBillingPortal(workspaceId))}
          >
            {busy ? 'Opening…' : 'Manage billing'} <ExternalLink size={16} />
          </button>
        ) : isOwner ? (
          <button
            className="button primary-button"
            disabled={busy}
            onClick={() => void redirect(() => startCheckout(workspaceId))}
          >
            {busy ? 'Opening…' : 'Upgrade with Stripe'}{' '}
            <ExternalLink size={16} />
          </button>
        ) : null}
      </article>
      <article className="billing-details">
        <p className="eyebrow">Pro includes</p>
        <h2>Operational support, without hidden automation</h2>
        <ul>
          <li>
            <Check size={17} />
            Unified multi-channel inbox
          </li>
          <li>
            <Check size={17} />
            Grounded AI drafts with citations
          </li>
          <li>
            <Check size={17} />
            Retrieval evaluation and analytics
          </li>
          <li>
            <Check size={17} />
            Human approval before every send
          </li>
        </ul>
        <p className="billing-fineprint">
          Stripe securely hosts checkout and payment management. Chanda does not
          collect or store card details.
        </p>
      </article>
    </section>
  );
}
