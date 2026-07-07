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
  gt,
  isNull,
  messages,
  ne,
  oauthConnectionStates,
  sql,
  tickets,
  workspaceTicketSequences,
} from '@suppline/database';

import { DatabaseService } from '../../database/database.service';
import type {
  GmailConnectionSummary,
  GmailInboundMessage,
  GmailRepository,
} from './gmail.types';

@Injectable()
export class DrizzleGmailRepository implements GmailRepository {
  constructor(private readonly database: DatabaseService) {}

  async createOAuthState(input: {
    expiresAt: Date;
    requestedByUserId: string;
    stateHash: string;
    workspaceId: string;
  }): Promise<void> {
    await this.database.db.insert(oauthConnectionStates).values({
      ...input,
      provider: 'gmail',
    });
  }

  async consumeOAuthState(stateHash: string) {
    return this.database.db.transaction(async (transaction) => {
      const [state] = await transaction
        .update(oauthConnectionStates)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(oauthConnectionStates.stateHash, stateHash),
            eq(oauthConnectionStates.provider, 'gmail'),
            isNull(oauthConnectionStates.usedAt),
            gt(oauthConnectionStates.expiresAt, new Date()),
          ),
        )
        .returning({
          requestedByUserId: oauthConnectionStates.requestedByUserId,
          workspaceId: oauthConnectionStates.workspaceId,
        });
      return state ?? null;
    });
  }

  async findConnection(
    workspaceId: string,
  ): Promise<GmailConnectionSummary | null> {
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
          eq(channelConnections.kind, 'gmail'),
        ),
      )
      .limit(1);
    return connection ? toSummary(connection, false, '') : null;
  }

  async saveConnection(input: {
    connectionId: string;
    emailAddress: string;
    encryptedCredentials: string;
    historyId: string;
    workspaceId: string;
  }): Promise<GmailConnectionSummary> {
    return this.database.db.transaction(async (transaction) => {
      const settings = {
        emailAddress: input.emailAddress,
        historyId: input.historyId,
        lastSyncAt: null,
        lastSyncError: null,
      };
      const [connection] = await transaction
        .insert(channelConnections)
        .values({
          id: input.connectionId,
          kind: 'gmail',
          name: input.emailAddress,
          settings,
          status: 'active',
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          set: {
            name: input.emailAddress,
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
      if (!connection) throw new Error('Unable to save Gmail connection.');
      await transaction
        .insert(channelConnectionSecrets)
        .values({
          channelConnectionId: connection.id,
          encryptedCredentials: input.encryptedCredentials,
          webhookSecretHash: null,
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          set: {
            encryptedCredentials: input.encryptedCredentials,
            encryptionKeyVersion: 1,
            updatedAt: new Date(),
            webhookSecretHash: null,
            workspaceId: input.workspaceId,
          },
          target: channelConnectionSecrets.channelConnectionId,
        });
      return toSummary(connection, false, '');
    });
  }

  async findCredential(workspaceId: string) {
    const [record] = await this.database.db
      .select({
        connectionId: channelConnections.id,
        encryptedCredentials: channelConnectionSecrets.encryptedCredentials,
        settings: channelConnections.settings,
      })
      .from(channelConnections)
      .innerJoin(
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
          eq(channelConnections.workspaceId, workspaceId),
          eq(channelConnections.kind, 'gmail'),
          ne(channelConnections.status, 'disconnected'),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  async saveSyncSuccess(
    workspaceId: string,
    historyId: string,
    syncedAt: Date,
  ) {
    await this.database.db
      .update(channelConnections)
      .set({
        settings: sql`coalesce(${channelConnections.settings}, '{}'::jsonb) || ${JSON.stringify(
          {
            historyId,
            lastSyncAt: syncedAt.toISOString(),
            lastSyncError: null,
          },
        )}::jsonb`,
        status: 'active',
        updatedAt: syncedAt,
      })
      .where(
        and(
          eq(channelConnections.workspaceId, workspaceId),
          eq(channelConnections.kind, 'gmail'),
        ),
      );
  }

  async markSyncFailure(workspaceId: string, message: string) {
    await this.database.db
      .update(channelConnections)
      .set({
        settings: sql`coalesce(${channelConnections.settings}, '{}'::jsonb) || ${JSON.stringify(
          { lastSyncError: message },
        )}::jsonb`,
        status: 'error',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channelConnections.workspaceId, workspaceId),
          eq(channelConnections.kind, 'gmail'),
        ),
      );
  }

  async disconnect(workspaceId: string): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [connection] = await transaction
        .select({ id: channelConnections.id })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.workspaceId, workspaceId),
            eq(channelConnections.kind, 'gmail'),
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

  async findDeliveryContext(
    workspaceId: string,
    conversationId: string,
    draftId?: string,
  ) {
    const [context] = await this.database.db
      .select({
        encryptedCredentials: channelConnectionSecrets.encryptedCredentials,
        kind: channelConnections.kind,
        subject: conversations.subject,
        threadId: conversations.externalThreadId,
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
    if (context.kind !== 'gmail') return { channel: 'other' as const };
    const [inbound] = await this.database.db
      .select({ metadata: messages.metadata })
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
    const metadata = inbound?.metadata ?? {};
    const to = typeof metadata.fromEmail === 'string' ? metadata.fromEmail : '';
    if (!context.encryptedCredentials || !to) return null;
    return {
      channel: 'gmail' as const,
      encryptedCredentials: context.encryptedCredentials,
      messageIdHeader:
        typeof metadata.gmailMessageIdHeader === 'string'
          ? metadata.gmailMessageIdHeader
          : null,
      subject: context.subject ?? 'Support request',
      threadId: context.threadId,
      to,
    };
  }

  async ingest(connectionId: string, input: GmailInboundMessage) {
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
            eq(channelConnections.kind, 'gmail'),
            eq(channelConnections.status, 'active'),
          ),
        )
        .limit(1);
      if (!connection) throw new Error('Gmail connection is unavailable.');

      const [identity] = await transaction
        .select({ customerId: customerChannelIdentities.customerId })
        .from(customerChannelIdentities)
        .where(
          and(
            eq(customerChannelIdentities.channelConnectionId, connection.id),
            eq(customerChannelIdentities.externalCustomerId, input.fromEmail),
          ),
        )
        .limit(1);
      let customerId = identity?.customerId;
      if (!customerId) {
        const [customer] = await transaction
          .insert(customers)
          .values({
            displayName: input.fromName,
            email: input.fromEmail,
            workspaceId: connection.workspaceId,
          })
          .returning({ id: customers.id });
        if (!customer) throw new Error('Unable to create Gmail customer.');
        customerId = customer.id;
        await transaction.insert(customerChannelIdentities).values({
          channelConnectionId: connection.id,
          customerId,
          externalCustomerId: input.fromEmail,
          workspaceId: connection.workspaceId,
        });
      }

      let [conversation] = await transaction
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.channelConnectionId, connection.id),
            eq(conversations.externalThreadId, input.threadId),
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
            externalThreadId: input.threadId,
            subject: input.subject,
            workspaceId: connection.workspaceId,
          })
          .returning({ id: conversations.id });
        if (!conversation) throw new Error('Unable to create Gmail thread.');
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
        if (!ticket) throw new Error('Gmail ticket is unavailable.');
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
          metadata: {
            fromEmail: input.fromEmail,
            gmailMessageIdHeader: input.gmailMessageIdHeader,
          },
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
        if (!duplicate) throw new Error('Gmail deduplication failed.');
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
          subject: input.subject,
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

function toSummary(
  connection: {
    id: string;
    lastInboundAt: Date | null;
    name: string;
    settings: Record<string, unknown>;
    status: 'active' | 'disconnected' | 'error';
  },
  oauthConfigured: boolean,
  redirectUri: string,
): GmailConnectionSummary {
  return {
    emailAddress:
      typeof connection.settings.emailAddress === 'string'
        ? connection.settings.emailAddress
        : null,
    id: connection.id,
    lastInboundAt: connection.lastInboundAt,
    lastSyncAt:
      typeof connection.settings.lastSyncAt === 'string'
        ? connection.settings.lastSyncAt
        : null,
    lastSyncError:
      typeof connection.settings.lastSyncError === 'string'
        ? connection.settings.lastSyncError
        : null,
    name: connection.name,
    oauthConfigured,
    redirectUri,
    status: connection.status,
  };
}
