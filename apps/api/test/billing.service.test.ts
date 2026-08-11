import type { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';

import { BillingService } from '../src/billing/billing.service';

function setup(values: Record<string, string> = {}) {
  const config = {
    get: vi.fn((name: string) => values[name]),
  } as unknown as ConfigService;
  const repository = {
    applySubscription: vi.fn().mockResolvedValue(true),
    createCustomerAccount: vi.fn(),
    findByCustomer: vi.fn(),
    findByWorkspace: vi.fn(),
  };
  return {
    repository,
    service: new BillingService(config, repository as never),
  };
}

function subscriptionWebhookPayload(status: string): string {
  return JSON.stringify({
    id: `evt_${status}`,
    object: 'event',
    api_version: '2026-06-30.basil',
    created: 1785542400,
    data: {
      object: {
        id: 'sub_1',
        object: 'subscription',
        cancel_at_period_end: false,
        customer: 'cus_1',
        metadata: { workspaceId: 'workspace-1' },
        status,
        items: {
          data: [
            { current_period_end: 1788220800, price: { id: 'price_pro' } },
          ],
        },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'customer.subscription.updated',
  });
}

describe('BillingService', () => {
  it('derives free and Pro entitlement only from persisted subscription state', async () => {
    const { repository, service } = setup();
    repository.findByWorkspace
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
        latestStripeEventCreatedAt: new Date('2026-07-20T00:00:00Z'),
        subscriptionStatus: 'active',
      });
    await expect(service.summary('workspace-1')).resolves.toMatchObject({
      entitlement: 'free',
      status: 'free',
    });
    await expect(service.summary('workspace-1')).resolves.toMatchObject({
      entitlement: 'pro',
      status: 'active',
    });
  });

  it('verifies a signed webhook and projects a subscription event', async () => {
    const secret = 'whsec_test_secret';
    const { repository, service } = setup({
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: secret,
    });
    repository.findByCustomer.mockResolvedValue({ workspaceId: 'workspace-1' });
    const payload = subscriptionWebhookPayload('active');
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    await expect(
      service.handleWebhook(Buffer.from(payload), signature),
    ).resolves.toEqual({ received: true });
    expect(repository.applySubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_active',
        status: 'active',
        workspaceId: 'workspace-1',
      }),
    );
  });

  it('fails closed when Stripe introduces an unknown subscription status', async () => {
    const secret = 'whsec_test_secret';
    const { repository, service } = setup({
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: secret,
    });
    repository.findByCustomer.mockResolvedValue({ workspaceId: 'workspace-1' });
    const payload = subscriptionWebhookPayload('future_status');
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });

    await service.handleWebhook(Buffer.from(payload), signature);

    expect(repository.applySubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unpaid' }),
    );
  });
});
