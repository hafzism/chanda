import { Injectable } from '@nestjs/common';
import {
  aiDrafts,
  and,
  channelConnectionSecrets,
  channelConnections,
  conversations,
  customerChannelIdentities,
  customers,
  desc,
  eq,
  messages,
  sql,
  tickets,
  workspaceTicketSequences,
} from '@suppline/database';

import { DatabaseService } from '../../database/database.service';
import type {
  WhatsAppConnectionSummary,
  WhatsAppInboundMessage,
  WhatsAppRepository,
} from './whatsapp.types';

@Injectable()
export class DrizzleWhatsAppRepository implements WhatsAppRepository {
  constructor(private readonly database: DatabaseService) {}

  async findConnection(workspaceId: string) {
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
          eq(channelConnections.kind, 'whatsapp'),
        ),
      )
      .limit(1);
    return connection ? toSummary(connection) : null;
  }

  async saveConnection(input: {
    connectionId: string;
    encryptedCredentials: string;
    phone: {
      displayPhoneNumber: string;
      id: string;
      verifiedName: string;
    };
    webhookSecretHash: string;
    webhookUrl: string;
    workspaceId: string;
  }) {
    return this.database.db.transaction(async (transaction) => {
      const settings = {
        displayPhoneNumber: input.phone.displayPhoneNumber,
        phoneNumberId: input.phone.id,
        verifiedName: input.phone.verifiedName,
        webhookUrl: input.webhookUrl,
        webhookVerifiedAt: null,
      };
      const [connection] = await transaction
        .insert(channelConnections)
        .values({
          id: input.connectionId,
          kind: 'whatsapp',
          name: `${input.phone.verifiedName} (${input.phone.displayPhoneNumber})`,
          settings,
          status: 'active',
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          set: {
            name: `${input.phone.verifiedName} (${input.phone.displayPhoneNumber})`,
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
      if (!connection) throw new Error('Unable to save WhatsApp connection.');
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

  async markWebhookVerified(connectionId: string) {
    const verifiedAt = new Date();
    await this.database.db
      .update(channelConnections)
      .set({
        settings: sql`coalesce(${channelConnections.settings}, '{}'::jsonb) || ${JSON.stringify(
          { webhookVerifiedAt: verifiedAt.toISOString() },
        )}::jsonb`,
        updatedAt: verifiedAt,
      })
      .where(
        and(
          eq(channelConnections.id, connectionId),
          eq(channelConnections.kind, 'whatsapp'),
        ),
      );
  }

  async disconnect(workspaceId: string) {
    return this.database.db.transaction(async (transaction) => {
      const [connection] = await transaction
        .select({ id: channelConnections.id })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.workspaceId, workspaceId),
            eq(channelConnections.kind, 'whatsapp'),
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
        settings: channelConnections.settings,
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
          eq(channelConnections.kind, 'whatsapp'),
          eq(channelConnections.status, 'active'),
        ),
      )
      .where(eq(channelConnectionSecrets.channelConnectionId, connectionId))
      .limit(1);
    const phoneNumberId = readSetting(credential?.settings, 'phoneNumberId');
    if (!credential?.webhookSecretHash || !phoneNumberId) return null;
    return {
      encryptedCredentials: credential.encryptedCredentials,
      phoneNumberId,
      webhookSecretHash: credential.webhookSecretHash,
    };
  }

  async findDeliveryContext(
    workspaceId: string,
    conversationId: string,
    draftId?: string,
  ) {
    const [context] = await this.database.db
      .select({
        encryptedCredentials: channelConnectionSecrets.encryptedCredentials,
        kind: channelConnections.kind,
        phoneNumber: conversations.externalThreadId,
        settings: channelConnections.settings,
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
    if (context.kind !== 'whatsapp') return { channel: 'other' as const };
    const [latestInbound] = await this.database.db
      .select({ occurredAt: messages.occurredAt })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
          eq(messages.direction, 'inbound'),
        ),
      )
      .orderBy(desc(messages.occurredAt))
      .limit(1);
    const phoneNumberId = readSetting(context.settings, 'phoneNumberId');
    if (!latestInbound || !phoneNumberId) return null;
    return {
      channel: 'whatsapp' as const,
      encryptedCredentials: context.encryptedCredentials,
      lastInboundAt: latestInbound.occurredAt,
      phoneNumber: context.phoneNumber,
      phoneNumberId,
    };
  }

  async markDeliveryStatus(
    connectionId: string,
    externalMessageId: string,
    status: string,
    occurredAt: Date,
    error: string | null,
  ) {
    await this.database.db
      .update(messages)
      .set({
        metadata: sql`coalesce(${messages.metadata}, '{}'::jsonb) || ${JSON.stringify(
          {
            whatsappDeliveryError: error,
            whatsappDeliveryStatus: status,
            whatsappDeliveryUpdatedAt: occurredAt.toISOString(),
          },
        )}::jsonb`,
      })
      .where(
        and(
          eq(messages.channelConnectionId, connectionId),
          eq(messages.externalMessageId, externalMessageId),
          eq(messages.direction, 'outbound'),
        ),
      );
  }

  async ingest(connectionId: string, input: WhatsAppInboundMessage) {
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
            eq(channelConnections.kind, 'whatsapp'),
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
            eq(customerChannelIdentities.externalCustomerId, input.phoneNumber),
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
        if (!customer) throw new Error('Unable to create WhatsApp customer.');
        customerId = customer.id;
        await transaction.insert(customerChannelIdentities).values({
          channelConnectionId: connection.id,
          customerId,
          externalCustomerId: input.phoneNumber,
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
            eq(conversations.externalThreadId, input.phoneNumber),
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
            externalThreadId: input.phoneNumber,
            workspaceId: connection.workspaceId,
          })
          .returning({ id: conversations.id });
        if (!conversation)
          throw new Error('Unable to create WhatsApp conversation.');
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
        if (!ticket) throw new Error('WhatsApp ticket is unavailable.');
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
          occurredAt: input.occurredAt,
          workspaceId: connection.workspaceId,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });
      if (!message) {
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
        if (!duplicate) throw new Error('WhatsApp deduplication failed.');
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
      return {
        conversationId: conversation.id,
        messageId: message.id,
        ticketNumber,
      };
    });
  }
}

function toSummary(connection: {
  id: string;
  lastInboundAt: Date | null;
  name: string;
  settings: Record<string, unknown>;
  status: 'active' | 'disconnected' | 'error';
}): WhatsAppConnectionSummary {
  return {
    displayPhoneNumber: readSetting(connection.settings, 'displayPhoneNumber'),
    id: connection.id,
    lastInboundAt: connection.lastInboundAt,
    name: connection.name,
    phoneNumberId: readSetting(connection.settings, 'phoneNumberId'),
    status: connection.status,
    verifiedName: readSetting(connection.settings, 'verifiedName'),
    webhookUrl: readSetting(connection.settings, 'webhookUrl'),
    webhookVerifiedAt: readSetting(connection.settings, 'webhookVerifiedAt'),
  };
}

function readSetting(
  settings: Record<string, unknown> | undefined,
  key: string,
) {
  return typeof settings?.[key] === 'string' ? settings[key] : null;
}
