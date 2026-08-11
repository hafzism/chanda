import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { BillingRepository } from './billing.repository';
import type { BillingSubscriptionStatus } from './billing.types';

const BILLING_STATUS_BY_STRIPE_VALUE: Readonly<
  Record<string, BillingSubscriptionStatus>
> = {
  active: 'active',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  past_due: 'past_due',
  paused: 'paused',
  trialing: 'trialing',
  unpaid: 'unpaid',
};

function normalizeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): BillingSubscriptionStatus {
  return BILLING_STATUS_BY_STRIPE_VALUE[status] ?? 'unpaid';
}
import type { BillingSummary } from './billing.types';

@Injectable()
export class BillingService {
  constructor(
    private readonly config: ConfigService,
    private readonly repository: BillingRepository,
  ) {}

  async summary(workspaceId: string): Promise<BillingSummary> {
    const account = await this.repository.findByWorkspace(workspaceId);
    const graceEndsAt =
      account?.subscriptionStatus === 'past_due' &&
      account.latestStripeEventCreatedAt
        ? new Date(
            account.latestStripeEventCreatedAt.getTime() + 3 * 86_400_000,
          )
        : null;
    const pro =
      account?.subscriptionStatus === 'active' ||
      account?.subscriptionStatus === 'trialing' ||
      (graceEndsAt !== null && graceEndsAt > new Date());
    return {
      cancelAtPeriodEnd: account?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: account?.currentPeriodEnd?.toISOString() ?? null,
      entitlement: pro ? 'pro' : 'free',
      graceEndsAt: graceEndsAt?.toISOString() ?? null,
      status: account?.subscriptionStatus ?? 'free',
    };
  }

  async createCheckout(workspaceId: string, email: string) {
    const stripe = this.stripe();
    const price = this.required('STRIPE_PRO_PRICE_ID');
    const appUrl = this.required('WEB_APP_URL');
    let account = await this.repository.findByWorkspace(workspaceId);
    if (account?.stripeSubscriptionId) {
      return this.createPortal(workspaceId);
    }
    if (!account) {
      const customer = await stripe.customers.create({
        email,
        metadata: { workspaceId },
      });
      account = await this.repository.createCustomerAccount(
        workspaceId,
        customer.id,
      );
    }
    if (!account)
      throw new ServiceUnavailableException(
        'Unable to prepare billing. Try again.',
      );
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${appUrl}/app?section=Billing&checkout=canceled`,
      customer: account.stripeCustomerId,
      line_items: [{ price, quantity: 1 }],
      metadata: { workspaceId },
      mode: 'subscription',
      subscription_data: { metadata: { workspaceId } },
      success_url: `${appUrl}/app?section=Billing&checkout=processing`,
    });
    if (!session.url)
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout URL.',
      );
    return { url: session.url };
  }

  async createPortal(workspaceId: string) {
    const account = await this.repository.findByWorkspace(workspaceId);
    if (!account)
      throw new ServiceUnavailableException(
        'Start a subscription before opening billing management.',
      );
    const session = await this.stripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${this.required('WEB_APP_URL')}/app?section=Billing`,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe().webhooks.constructEvent(
        rawBody,
        signature,
        this.required('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestException('Stripe webhook signature is invalid.');
    }
    if (!event.type.startsWith('customer.subscription.'))
      return { received: true };
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const account = await this.repository.findByCustomer(customerId);
    if (!account) return { received: true };
    const item = subscription.items.data[0];
    await this.repository.applySubscription({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      customerId,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
      eventCreatedAt: new Date(event.created * 1000),
      eventId: event.id,
      eventType: event.type,
      priceId: item?.price.id ?? null,
      status: normalizeSubscriptionStatus(subscription.status),
      subscriptionId: subscription.id,
      workspaceId: account.workspaceId,
    });
    return { received: true };
  }

  private stripe() {
    return new Stripe(this.required('STRIPE_SECRET_KEY'));
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value)
      throw new ServiceUnavailableException(
        `Billing is not configured: ${name} is missing.`,
      );
    return value;
  }
}
