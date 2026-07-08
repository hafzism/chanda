import { Injectable } from '@nestjs/common';
import {
  eq,
  sql,
  stripeWebhookEvents,
  workspaceBillingAccounts,
} from '@suppline/database';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class BillingRepository {
  constructor(private readonly database: DatabaseService) {}

  async findByWorkspace(workspaceId: string) {
    const [row] = await this.database.db
      .select()
      .from(workspaceBillingAccounts)
      .where(eq(workspaceBillingAccounts.workspaceId, workspaceId))
      .limit(1);
    return row ?? null;
  }

  async findByCustomer(customerId: string) {
    const [row] = await this.database.db
      .select()
      .from(workspaceBillingAccounts)
      .where(eq(workspaceBillingAccounts.stripeCustomerId, customerId))
      .limit(1);
    return row ?? null;
  }

  async createCustomerAccount(workspaceId: string, customerId: string) {
    const [row] = await this.database.db
      .insert(workspaceBillingAccounts)
      .values({ stripeCustomerId: customerId, workspaceId })
      .onConflictDoNothing({ target: workspaceBillingAccounts.workspaceId })
      .returning();
    return row ?? this.findByWorkspace(workspaceId);
  }

  async applySubscription(input: {
    cancelAtPeriodEnd: boolean;
    customerId: string;
    currentPeriodEnd: Date | null;
    eventCreatedAt: Date;
    eventId: string;
    eventType: string;
    priceId: string | null;
    status: typeof workspaceBillingAccounts.$inferInsert.subscriptionStatus;
    subscriptionId: string;
    workspaceId: string;
  }) {
    return this.database.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(stripeWebhookEvents)
        .values({
          eventCreatedAt: input.eventCreatedAt,
          eventId: input.eventId,
          eventType: input.eventType,
          workspaceId: input.workspaceId,
        })
        .onConflictDoNothing({ target: stripeWebhookEvents.eventId })
        .returning({ eventId: stripeWebhookEvents.eventId });
      if (!inserted[0]) return false;

      await tx
        .insert(workspaceBillingAccounts)
        .values({
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          currentPeriodEnd: input.currentPeriodEnd,
          latestStripeEventCreatedAt: input.eventCreatedAt,
          stripeCustomerId: input.customerId,
          stripePriceId: input.priceId,
          stripeSubscriptionId: input.subscriptionId,
          subscriptionStatus: input.status,
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          target: workspaceBillingAccounts.workspaceId,
          set: {
            cancelAtPeriodEnd: input.cancelAtPeriodEnd,
            currentPeriodEnd: input.currentPeriodEnd,
            latestStripeEventCreatedAt: input.eventCreatedAt,
            stripeCustomerId: input.customerId,
            stripePriceId: input.priceId,
            stripeSubscriptionId: input.subscriptionId,
            subscriptionStatus: input.status,
            updatedAt: sql`now()`,
          },
          setWhere: sql`${workspaceBillingAccounts.workspaceId} = ${input.workspaceId} and (${workspaceBillingAccounts.latestStripeEventCreatedAt} is null or ${workspaceBillingAccounts.latestStripeEventCreatedAt} <= ${input.eventCreatedAt})`,
        });
      return true;
    });
  }
}
