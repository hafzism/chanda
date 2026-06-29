import { Injectable } from '@nestjs/common';
import {
  and,
  channelConnections,
  conversations,
  customerChannelIdentities,
  customers,
  eq,
  messages,
  sql,
  tickets,
  workspaceTicketSequences,
} from '@suppline/database';

import { DatabaseService } from '../database/database.service';
import type {
  SupportRepository,
  WebChannelSummary,
  WidgetMessageInput,
  WidgetMessageResult,
  WidgetConnectionPolicy,
} from './support.types';

@Injectable()
export class DrizzleSupportRepository implements SupportRepository {
  constructor(private readonly database: DatabaseService) {}

  async findWidgetConnectionPolicy(
    publicKey: string,
  ): Promise<WidgetConnectionPolicy | null> {
    const [connection] = await this.database.db
      .select({ allowedOrigins: channelConnections.allowedOrigins })
      .from(channelConnections)
      .where(
        and(
          eq(channelConnections.publicKey, publicKey),
          eq(channelConnections.kind, 'web'),
          eq(channelConnections.status, 'active'),
        ),
      )
      .limit(1);
    return connection ?? null;
  }

  async getWebChannel(workspaceId: string): Promise<WebChannelSummary | null> {
    const [connection] = await this.database.db
      .select({
        allowedOrigins: channelConnections.allowedOrigins,
        id: channelConnections.id,
        lastInboundAt: channelConnections.lastInboundAt,
        name: channelConnections.name,
        publicKey: channelConnections.publicKey,
        status: channelConnections.status,
      })
      .from(channelConnections)
      .where(
        and(
          eq(channelConnections.workspaceId, workspaceId),
          eq(channelConnections.kind, 'web'),
        ),
      )
      .limit(1);
    if (!connection?.publicKey) return null;
    return { ...connection, publicKey: connection.publicKey };
  }

  async updateWidgetOrigins(
    workspaceId: string,
    origins: string[],
  ): Promise<WebChannelSummary | null> {
    const [connection] = await this.database.db
      .update(channelConnections)
      .set({ allowedOrigins: origins, updatedAt: new Date() })
      .where(
        and(
          eq(channelConnections.workspaceId, workspaceId),
          eq(channelConnections.kind, 'web'),
        ),
      )
      .returning({
        allowedOrigins: channelConnections.allowedOrigins,
        id: channelConnections.id,
        lastInboundAt: channelConnections.lastInboundAt,
        name: channelConnections.name,
        publicKey: channelConnections.publicKey,
        status: channelConnections.status,
      });
    if (!connection?.publicKey) return null;
    return { ...connection, publicKey: connection.publicKey };
  }

  async ingestWidgetMessage(
    input: WidgetMessageInput,
  ): Promise<WidgetMessageResult | null> {
    return this.database.db.transaction(async (transaction) => {
      const [connection] = await transaction
        .select({
          id: channelConnections.id,
          workspaceId: channelConnections.workspaceId,
        })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.publicKey, input.publicKey),
            eq(channelConnections.kind, 'web'),
            eq(channelConnections.status, 'active'),
          ),
        )
        .limit(1);
      if (!connection) return null;

      const [existingIdentity] = await transaction
        .select({ customerId: customerChannelIdentities.customerId })
        .from(customerChannelIdentities)
        .where(
          and(
            eq(customerChannelIdentities.channelConnectionId, connection.id),
            eq(
              customerChannelIdentities.externalCustomerId,
              input.externalVisitorId,
            ),
          ),
        )
        .limit(1);

      let customerId = existingIdentity?.customerId;
      if (!customerId) {
        const [customer] = await transaction
          .insert(customers)
          .values({
            displayName: input.displayName,
            email: input.email,
            workspaceId: connection.workspaceId,
          })
          .returning({ id: customers.id });
        if (!customer) throw new Error('Unable to create widget customer.');
        customerId = customer.id;
        await transaction.insert(customerChannelIdentities).values({
          channelConnectionId: connection.id,
          customerId,
          externalCustomerId: input.externalVisitorId,
          workspaceId: connection.workspaceId,
        });
      } else if (input.displayName || input.email) {
        await transaction
          .update(customers)
          .set({
            ...(input.displayName ? { displayName: input.displayName } : {}),
            ...(input.email ? { email: input.email } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customers.id, customerId),
              eq(customers.workspaceId, connection.workspaceId),
            ),
          );
      }

      const [existingConversation] = await transaction
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.channelConnectionId, connection.id),
            eq(conversations.externalThreadId, input.externalThreadId),
          ),
        )
        .limit(1);

      let conversationId = existingConversation?.id;
      let ticketNumber: number;
      if (!conversationId) {
        const [conversation] = await transaction
          .insert(conversations)
          .values({
            channelConnectionId: connection.id,
            customerId,
            externalThreadId: input.externalThreadId,
            workspaceId: connection.workspaceId,
          })
          .returning({ id: conversations.id });
        if (!conversation) throw new Error('Unable to create conversation.');
        conversationId = conversation.id;

        const [sequence] = await transaction
          .insert(workspaceTicketSequences)
          .values({ nextNumber: 2, workspaceId: connection.workspaceId })
          .onConflictDoUpdate({
            set: {
              nextNumber: sql`${workspaceTicketSequences.nextNumber} + 1`,
            },
            target: workspaceTicketSequences.workspaceId,
          })
          .returning({ nextNumber: workspaceTicketSequences.nextNumber });
        if (!sequence) throw new Error('Unable to allocate a ticket number.');
        ticketNumber = sequence.nextNumber - 1;
        await transaction.insert(tickets).values({
          conversationId,
          number: ticketNumber,
          workspaceId: connection.workspaceId,
        });
      } else {
        const [ticket] = await transaction
          .select({ number: tickets.number })
          .from(tickets)
          .where(eq(tickets.conversationId, conversationId))
          .limit(1);
        if (!ticket) throw new Error('Conversation ticket is unavailable.');
        ticketNumber = ticket.number;
      }

      const [message] = await transaction
        .insert(messages)
        .values({
          authorKind: 'customer',
          body: input.body,
          channelConnectionId: connection.id,
          conversationId,
          direction: 'inbound',
          externalMessageId: input.externalMessageId,
          occurredAt: new Date(),
          workspaceId: connection.workspaceId,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });

      let messageId = message?.id;
      if (!messageId) {
        const [duplicate] = await transaction
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.channelConnectionId, connection.id),
              eq(messages.externalMessageId, input.externalMessageId),
            ),
          )
          .limit(1);
        if (!duplicate) throw new Error('Unable to resolve duplicate message.');
        messageId = duplicate.id;
      } else {
        const occurredAt = new Date();
        await transaction
          .update(conversations)
          .set({
            lastMessageAt: occurredAt,
            status: 'open',
            updatedAt: occurredAt,
          })
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.workspaceId, connection.workspaceId),
            ),
          );
        await transaction
          .update(channelConnections)
          .set({ lastInboundAt: occurredAt, updatedAt: occurredAt })
          .where(eq(channelConnections.id, connection.id));
      }

      return { conversationId, messageId, ticketNumber };
    });
  }
}
