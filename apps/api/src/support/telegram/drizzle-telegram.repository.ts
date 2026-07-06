import { Injectable } from '@nestjs/common';
import {
  aiDrafts,
  and,
  channelConnectionSecrets,
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

import { DatabaseService } from '../../database/database.service';
import type {
  TelegramConnectionSummary,
  TelegramInboundMessage,
  TelegramRepository,
} from './telegram.types';

@Injectable()
export class DrizzleTelegramRepository implements TelegramRepository {
  constructor(private readonly database: DatabaseService) {}

  async findConnection(
    workspaceId: string,
  ): Promise<TelegramConnectionSummary | null> {
    const [connection] = await this.database.db
      .select({
        id: channelConnections.id,
        lastInboundAt: channelConnections.lastInboundAt,
        name: channelConnections.name,
        settings: channelConnections.settings,
        status: channelConnections.status,
      })
      .from(channelConnections)
      .where(
        and(
          eq(channelConnections.workspaceId, workspaceId),
          eq(channelConnections.kind, 'telegram'),
        ),
      )
      .limit(1);
    return connection ? toSummary(connection) : null;
  }

  async saveConnection(input: {
    bot: { firstName: string; id: string; username: string };
    connectionId: string;
    encryptedCredentials: string;
    webhookSecretHash: string;
    webhookUrl: string;
    workspaceId: string;
  }): Promise<TelegramConnectionSummary> {
    return this.database.db.transaction(async (transaction) => {
      const settings = {
        botFirstName: input.bot.firstName,
        botId: input.bot.id,
        botUsername: input.bot.username,
        webhookUrl: input.webhookUrl,
      };
      const [connection] = await transaction
        .insert(channelConnections)
        .values({
          id: input.connectionId,
          kind: 'telegram',
          name: `${input.bot.firstName} (@${input.bot.username})`,
          settings,
          status: 'active',
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          set: {
            name: `${input.bot.firstName} (@${input.bot.username})`,
            settings,
            status: 'active',
            updatedAt: new Date(),
          },
          target: [channelConnections.workspaceId, channelConnections.kind],
        })
        .returning({
          id: channelConnections.id,
          lastInboundAt: channelConnections.lastInboundAt,
          name: channelConnections.name,
          settings: channelConnections.settings,
          status: channelConnections.status,
        });
      if (!connection) throw new Error('Unable to save Telegram connection.');

      await transaction
        .insert(channelConnectionSecrets)
        .values({
          channelConnectionId: connection.id,
          encryptedCredentials: input.encryptedCredentials,
          webhookSecretHash: input.webhookSecretHash,
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          set: {
            encryptedCredentials: input.encryptedCredentials,
            encryptionKeyVersion: 1,
            updatedAt: new Date(),
            webhookSecretHash: input.webhookSecretHash,
            workspaceId: input.workspaceId,
          },
          target: channelConnectionSecrets.channelConnectionId,
        });
      return toSummary(connection);
    });
  }

  async disconnect(workspaceId: string): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [connection] = await transaction
        .select({ id: channelConnections.id })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.workspaceId, workspaceId),
            eq(channelConnections.kind, 'telegram'),
          ),
        )
        .limit(1);
      if (!connection) return false;
      await transaction
        .delete(channelConnectionSecrets)
        .where(
          and(
            eq(channelConnectionSecrets.channelConnectionId, connection.id),
            eq(channelConnectionSecrets.workspaceId, workspaceId),
          ),
        );
      await transaction
        .update(channelConnections)
        .set({ settings: {}, status: 'disconnected', updatedAt: new Date() })
        .where(
          and(
            eq(channelConnections.id, connection.id),
            eq(channelConnections.workspaceId, workspaceId),
          ),
        );
      return true;
    });
  }

  async findWebhookCredential(connectionId: string) {
    const [credential] = await this.database.db
      .select({
        encryptedCredentials: channelConnectionSecrets.encryptedCredentials,
        webhookSecretHash: channelConnectionSecrets.webhookSecretHash,
      })
      .from(channelConnectionSecrets)
      .innerJoin(
        channelConnections,
        and(
          eq(
            channelConnections.id,
            channelConnectionSecrets.channelConnectionId,
          ),
          eq(
            channelConnections.workspaceId,
            channelConnectionSecrets.workspaceId,
          ),
          eq(channelConnections.kind, 'telegram'),
          eq(channelConnections.status, 'active'),
        ),
      )
      .where(eq(channelConnectionSecrets.channelConnectionId, connectionId))
      .limit(1);
    return credential ?? null;
  }

  async findDeliveryContext(
    workspaceId: string,
    conversationId: string,
    draftId?: string,
  ): Promise<
    | { channel: 'other' }
    | {
        channel: 'telegram';
        chatId: string;
        encryptedCredentials: string;
      }
    | null
  > {
    const [context] = await this.database.db
      .select({
        chatId: conversations.externalThreadId,
        encryptedCredentials: channelConnectionSecrets.encryptedCredentials,
        kind: channelConnections.kind,
      })
      .from(conversations)
      .innerJoin(
        channelConnections,
        and(
          eq(channelConnections.id, conversations.channelConnectionId),
          eq(channelConnections.workspaceId, workspaceId),
        ),
      )
      .leftJoin(
        channelConnectionSecrets,
        and(
          eq(
            channelConnectionSecrets.channelConnectionId,
            channelConnections.id,
          ),
          eq(channelConnectionSecrets.workspaceId, workspaceId),
        ),
      )
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!context) return null;
    if (draftId) {
      const [draft] = await this.database.db
        .select({ id: aiDrafts.id })
        .from(aiDrafts)
        .where(
          and(
            eq(aiDrafts.id, draftId),
            eq(aiDrafts.workspaceId, workspaceId),
            eq(aiDrafts.conversationId, conversationId),
            eq(aiDrafts.status, 'generated'),
          ),
        )
        .limit(1);
      if (!draft) return null;
    }
    if (context.kind !== 'telegram') return { channel: 'other' };
    return {
      channel: 'telegram',
      chatId: context.chatId,
      encryptedCredentials: context.encryptedCredentials ?? '',
    };
  }

  async ingest(connectionId: string, input: TelegramInboundMessage) {
    return this.database.db.transaction(async (transaction) => {
      const [connection] = await transaction
        .select({
          id: channelConnections.id,
          workspaceId: channelConnections.workspaceId,
        })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.id, connectionId),
            eq(channelConnections.kind, 'telegram'),
            eq(channelConnections.status, 'active'),
          ),
        )
        .limit(1);
      if (!connection) return null;

      const [identity] = await transaction
        .select({ customerId: customerChannelIdentities.customerId })
        .from(customerChannelIdentities)
        .where(
          and(
            eq(customerChannelIdentities.channelConnectionId, connection.id),
            eq(
              customerChannelIdentities.externalCustomerId,
              input.telegramUserId,
            ),
          ),
        )
        .limit(1);
      let customerId = identity?.customerId;
      if (!customerId) {
        const [customer] = await transaction
          .insert(customers)
          .values({
            displayName: input.displayName,
            workspaceId: connection.workspaceId,
          })
          .returning({ id: customers.id });
        if (!customer) throw new Error('Unable to create Telegram customer.');
        customerId = customer.id;
        await transaction.insert(customerChannelIdentities).values({
          channelConnectionId: connection.id,
          customerId,
          externalCustomerId: input.telegramUserId,
          workspaceId: connection.workspaceId,
        });
      } else {
        await transaction
          .update(customers)
          .set({ displayName: input.displayName, updatedAt: new Date() })
          .where(
            and(
              eq(customers.id, customerId),
              eq(customers.workspaceId, connection.workspaceId),
            ),
          );
      }

      let [conversation] = await transaction
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.channelConnectionId, connection.id),
            eq(conversations.externalThreadId, input.chatId),
          ),
        )
        .limit(1);
      let ticketNumber: number;
      if (!conversation) {
        [conversation] = await transaction
          .insert(conversations)
          .values({
            channelConnectionId: connection.id,
            customerId,
            externalThreadId: input.chatId,
            workspaceId: connection.workspaceId,
          })
          .returning({ id: conversations.id });
        if (!conversation)
          throw new Error('Unable to create Telegram conversation.');
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
        if (!sequence) throw new Error('Unable to allocate ticket number.');
        ticketNumber = sequence.nextNumber - 1;
        await transaction.insert(tickets).values({
          conversationId: conversation.id,
          number: ticketNumber,
          workspaceId: connection.workspaceId,
        });
      } else {
        const [ticket] = await transaction
          .select({ number: tickets.number })
          .from(tickets)
          .where(
            and(
              eq(tickets.conversationId, conversation.id),
              eq(tickets.workspaceId, connection.workspaceId),
            ),
          )
          .limit(1);
        if (!ticket) throw new Error('Telegram ticket is unavailable.');
        ticketNumber = ticket.number;
      }

      const [message] = await transaction
        .insert(messages)
        .values({
          authorKind: 'customer',
          body: input.body,
          channelConnectionId: connection.id,
          conversationId: conversation.id,
          direction: 'inbound',
          externalMessageId: input.externalMessageId,
          metadata: input.username ? { telegramUsername: input.username } : {},
          occurredAt: input.occurredAt,
          workspaceId: connection.workspaceId,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });
      const messageId = message?.id;
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
        if (!duplicate) throw new Error('Telegram deduplication failed.');
        return {
          conversationId: conversation.id,
          messageId: duplicate.id,
          ticketNumber,
        };
      }

      const now = new Date();
      await transaction
        .update(channelConnections)
        .set({ lastInboundAt: now, updatedAt: now })
        .where(eq(channelConnections.id, connection.id));
      await transaction
        .update(conversations)
        .set({
          lastMessageAt: input.occurredAt,
          status: 'waiting_agent',
          updatedAt: now,
        })
        .where(
          and(
            eq(conversations.id, conversation.id),
            eq(conversations.workspaceId, connection.workspaceId),
          ),
        );
      await transaction
        .update(tickets)
        .set({ status: 'waiting_agent', updatedAt: now })
        .where(
          and(
            eq(tickets.conversationId, conversation.id),
            eq(tickets.workspaceId, connection.workspaceId),
          ),
        );
      return { conversationId: conversation.id, messageId, ticketNumber };
    });
  }
}

function toSummary(connection: {
  id: string;
  lastInboundAt: Date | null;
  name: string;
  settings: Record<string, unknown>;
  status: 'active' | 'disconnected' | 'error';
}): TelegramConnectionSummary {
  return {
    botFirstName:
      typeof connection.settings.botFirstName === 'string'
        ? connection.settings.botFirstName
        : null,
    botUsername:
      typeof connection.settings.botUsername === 'string'
        ? connection.settings.botUsername
        : null,
    id: connection.id,
    lastInboundAt: connection.lastInboundAt,
    name: connection.name,
    status: connection.status,
    webhookUrl:
      typeof connection.settings.webhookUrl === 'string'
        ? connection.settings.webhookUrl
        : null,
  };
}
