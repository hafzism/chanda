import { describe, expect, it } from 'vitest';

import {
  billingSubscriptionStatus,
  conversationStatus,
  channelConnections,
  knowledgeSourceKind,
  knowledgeVersionStatus,
  messageAuthorKind,
  supportChannelKind,
  ticketPriority,
  ticketStatus,
  outboxEvents,
  workspaceRole,
  workspaceBillingAccounts,
} from '../src/schema';

describe('workspace roles', () => {
  it('exposes only the supported authorization roles', () => {
    expect(workspaceRole.enumValues).toEqual([
      'owner',
      'admin',
      'agent',
      'viewer',
    ]);
  });
});

describe('normalized support domain enums', () => {
  it('keeps channel, conversation, author, and ticket lifecycles explicit', () => {
    expect(supportChannelKind.enumValues).toEqual([
      'web',
      'telegram',
      'whatsapp',
      'gmail',
      'facebook',
      'instagram',
    ]);
    expect(conversationStatus.enumValues).toEqual([
      'open',
      'waiting_customer',
      'waiting_agent',
      'resolved',
      'closed',
    ]);
    expect(messageAuthorKind.enumValues).toEqual([
      'customer',
      'agent',
      'ai',
      'system',
    ]);
    expect(ticketPriority.enumValues).toEqual([
      'low',
      'normal',
      'high',
      'urgent',
    ]);
    expect(ticketStatus.enumValues).toHaveLength(7);
  });

  it('stores an explicit widget origin policy on channel connections', () => {
    expect(channelConnections.allowedOrigins).toBeDefined();
  });
});

describe('transactional outbox', () => {
  it('exposes durable event state for asynchronous handoff', () => {
    expect(outboxEvents.topic).toBeDefined();
    expect(outboxEvents.payload).toBeDefined();
    expect(outboxEvents.publishedAt).toBeDefined();
  });
});

describe('knowledge lifecycle enums', () => {
  it('keeps source and indexing states explicit', () => {
    expect(knowledgeSourceKind.enumValues).toEqual(['file', 'article']);
    expect(knowledgeVersionStatus.enumValues).toEqual([
      'queued',
      'processing',
      'ready',
      'failed',
    ]);
  });
});

describe('workspace billing state', () => {
  it('models asynchronous Stripe subscription states explicitly', () => {
    expect(billingSubscriptionStatus.enumValues).toEqual([
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused',
    ]);
    expect(workspaceBillingAccounts.stripeCustomerId).toBeDefined();
    expect(workspaceBillingAccounts.latestStripeEventCreatedAt).toBeDefined();
  });
});
