export type BillingSubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface BillingAccount {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  latestStripeEventCreatedAt: Date | null;
  subscriptionStatus: BillingSubscriptionStatus | null;
}

export interface BillingSummary {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  entitlement: 'free' | 'pro';
  graceEndsAt: string | null;
  status: BillingSubscriptionStatus | 'free';
}
