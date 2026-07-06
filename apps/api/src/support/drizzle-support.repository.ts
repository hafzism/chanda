import { Injectable } from '@nestjs/common';
import {
  aiDrafts,
  and,
  channelConnections,
  conversations,
  customerChannelIdentities,
  customers,
  desc,
  eq,
  messages,
  sql,
  ticketNotes,
  tickets,
  workspaceTicketSequences,
} from '@suppline/database';

import { DatabaseService } from '../database/database.service';
import type {
  AiDraft,
  AiDraftContext,
  CreateAiDraftRecord,
  SupportRepository,
  InboxConversationDetail,
  InboxConversationSummary,
  InboxMessage,
  InboxNote,
  TicketUpdate,
  WebChannelSummary,
  WidgetMessageInput,
  WidgetMessageResult,
  WidgetConnectionPolicy,
  WidgetConversationRead,
} from './support.types';

@Injectable()
export class DrizzleSupportRepository implements SupportRepository {
  constructor(private readonly database: DatabaseService) {}

  async addInboxNote(
    workspaceId: string,
    conversationId: string,
    userId: string,
    body: string,
  ): Promise<InboxNote | null> {
    const [ticket] = await this.database.db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.workspaceId, workspaceId),
          eq(tickets.conversationId, conversationId),
        ),
      )
      .limit(1);
    if (!ticket) return null;
    const [note] = await this.database.db
      .insert(ticketNotes)
      .values({
        authorUserId: userId,
        body,
        ticketId: ticket.id,
        workspaceId,
      })
      .returning({
        authorUserId: ticketNotes.authorUserId,
        body: ticketNotes.body,
        createdAt: ticketNotes.createdAt,
        id: ticketNotes.id,
      });
    return note ?? null;
  }

  async listInbox(workspaceId: string): Promise<InboxConversationSummary[]> {
    return this.database.db
      .select({
        channel: channelConnections.kind,
        conversationId: conversations.id,
        customerDisplayName: customers.displayName,
        customerEmail: customers.email,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: sql<string | null>`(
          select ${messages.body}
          from ${messages}
          where ${messages.conversationId} = ${conversations.id}
          order by ${messages.occurredAt} desc
          limit 1
        )`,
        priority: tickets.priority,
        status: tickets.status,
        ticketId: tickets.id,
        ticketNumber: tickets.number,
      })
      .from(conversations)
      .innerJoin(
        channelConnections,
        and(
          eq(channelConnections.id, conversations.channelConnectionId),
          eq(channelConnections.workspaceId, workspaceId),
        ),
      )
      .innerJoin(
        customers,
        and(
          eq(customers.id, conversations.customerId),
          eq(customers.workspaceId, workspaceId),
        ),
      )
      .innerJoin(
        tickets,
        and(
          eq(tickets.conversationId, conversations.id),
          eq(tickets.workspaceId, workspaceId),
        ),
      )
      .where(eq(conversations.workspaceId, workspaceId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(100);
  }

  async getInboxConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<InboxConversationDetail | null> {
    const summary = (await this.database.db
      .select({
        channel: channelConnections.kind,
        conversationId: conversations.id,
        customerDisplayName: customers.displayName,
        customerEmail: customers.email,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: sql<string | null>`(
          select ${messages.body}
          from ${messages}
          where ${messages.conversationId} = ${conversations.id}
          order by ${messages.occurredAt} desc
          limit 1
        )`,
        priority: tickets.priority,
        status: tickets.status,
        ticketId: tickets.id,
        ticketNumber: tickets.number,
      })
      .from(conversations)
      .innerJoin(
        channelConnections,
        and(
          eq(channelConnections.id, conversations.channelConnectionId),
          eq(channelConnections.workspaceId, workspaceId),
        ),
      )
      .innerJoin(
        customers,
        and(
          eq(customers.id, conversations.customerId),
          eq(customers.workspaceId, workspaceId),
        ),
      )
      .innerJoin(
        tickets,
        and(
          eq(tickets.conversationId, conversations.id),
          eq(tickets.workspaceId, workspaceId),
        ),
      )
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, workspaceId),
        ),
      )
      .limit(1)) as InboxConversationSummary[];
    if (!summary[0]) return null;

    const records = await this.database.db
      .select({
        authorKind: messages.authorKind,
        body: messages.body,
        direction: messages.direction,
        id: messages.id,
        occurredAt: messages.occurredAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .orderBy(messages.occurredAt);

    const notes = await this.database.db
      .select({
        authorUserId: ticketNotes.authorUserId,
        body: ticketNotes.body,
        createdAt: ticketNotes.createdAt,
        id: ticketNotes.id,
      })
      .from(ticketNotes)
      .where(
        and(
          eq(ticketNotes.workspaceId, workspaceId),
          eq(ticketNotes.ticketId, summary[0].ticketId),
        ),
      )
      .orderBy(ticketNotes.createdAt);

    const [draftRecord] = await this.database.db
      .select({
        body: aiDrafts.body,
        citations: aiDrafts.citations,
        createdAt: aiDrafts.createdAt,
        escalationReason: aiDrafts.escalationReason,
        id: aiDrafts.id,
        model: aiDrafts.model,
        promptVersion: aiDrafts.promptVersion,
        provider: aiDrafts.provider,
        readinessScore: aiDrafts.readinessScore,
        requiresHuman: aiDrafts.requiresHuman,
        retrievalMode: aiDrafts.retrievalMode,
      })
      .from(aiDrafts)
      .where(
        and(
          eq(aiDrafts.workspaceId, workspaceId),
          eq(aiDrafts.conversationId, conversationId),
          eq(aiDrafts.status, 'generated'),
        ),
      )
      .orderBy(desc(aiDrafts.createdAt))
      .limit(1);
    const aiDraft = draftRecord
      ? ({
          ...draftRecord,
          retrievalMode: draftRecord.retrievalMode,
        } as AiDraft)
      : null;

    return { ...summary[0], aiDraft, messages: records, notes };
  }

  async getAiDraftContext(
    workspaceId: string,
    conversationId: string,
  ): Promise<AiDraftContext | null> {
    const [context] = await this.database.db
      .select({
        conversationId: conversations.id,
        inputMessageBody: messages.body,
        inputMessageId: messages.id,
        ticketId: tickets.id,
      })
      .from(conversations)
      .innerJoin(
        tickets,
        and(
          eq(tickets.conversationId, conversations.id),
          eq(tickets.workspaceId, workspaceId),
        ),
      )
      .innerJoin(
        messages,
        and(
          eq(messages.conversationId, conversations.id),
          eq(messages.workspaceId, workspaceId),
          eq(messages.direction, 'inbound'),
        ),
      )
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, workspaceId),
        ),
      )
      .orderBy(desc(messages.occurredAt))
      .limit(1);
    if (!context) return null;
    const transcript = await this.database.db
      .select({ authorKind: messages.authorKind, body: messages.body })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .orderBy(desc(messages.occurredAt))
      .limit(12);
    return { ...context, transcript: transcript.reverse() };
  }

  async saveAiDraft(input: CreateAiDraftRecord): Promise<AiDraft> {
    return this.database.db.transaction(async (transaction) => {
      const now = new Date();
      await transaction
        .update(aiDrafts)
        .set({ status: 'superseded', updatedAt: now })
        .where(
          and(
            eq(aiDrafts.workspaceId, input.workspaceId),
            eq(aiDrafts.conversationId, input.conversationId),
            eq(aiDrafts.status, 'generated'),
          ),
        );
      const [draft] = await transaction
        .insert(aiDrafts)
        .values(input)
        .returning({
          body: aiDrafts.body,
          citations: aiDrafts.citations,
          createdAt: aiDrafts.createdAt,
          escalationReason: aiDrafts.escalationReason,
          id: aiDrafts.id,
          model: aiDrafts.model,
          promptVersion: aiDrafts.promptVersion,
          provider: aiDrafts.provider,
          readinessScore: aiDrafts.readinessScore,
          requiresHuman: aiDrafts.requiresHuman,
          retrievalMode: aiDrafts.retrievalMode,
        });
      if (!draft) throw new Error('Unable to store the AI draft.');
      const ticketStatus = input.requiresHuman ? 'escalated' : 'waiting_agent';
      await transaction
        .update(tickets)
        .set({
          escalationReason: input.escalationReason,
          status: ticketStatus,
          updatedAt: now,
        })
        .where(
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.workspaceId, input.workspaceId),
          ),
        );
      await transaction
        .update(conversations)
        .set({ status: 'waiting_agent', updatedAt: now })
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.workspaceId, input.workspaceId),
          ),
        );
      return { ...draft, retrievalMode: draft.retrievalMode } as AiDraft;
    });
  }

  async readWidgetConversation(
    publicKey: string,
    threadId: string,
    tokenHash: string,
  ): Promise<WidgetConversationRead | null> {
    const [conversation] = await this.database.db
      .select({ id: conversations.id, workspaceId: conversations.workspaceId })
      .from(conversations)
      .innerJoin(
        channelConnections,
        eq(channelConnections.id, conversations.channelConnectionId),
      )
      .where(
        and(
          eq(channelConnections.publicKey, publicKey),
          eq(channelConnections.kind, 'web'),
          eq(channelConnections.status, 'active'),
          eq(conversations.externalThreadId, threadId),
          eq(conversations.publicAccessTokenHash, tokenHash),
        ),
      )
      .limit(1);
    if (!conversation) return null;
    const records = await this.database.db
      .select({
        authorKind: messages.authorKind,
        body: messages.body,
        direction: messages.direction,
        id: messages.id,
        occurredAt: messages.occurredAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, conversation.workspaceId),
          eq(messages.conversationId, conversation.id),
        ),
      )
      .orderBy(messages.occurredAt);
    return { messages: records };
  }

  async sendInboxReply(
    workspaceId: string,
    conversationId: string,
    userId: string,
    body: string,
    draftId?: string,
    externalMessageId?: string,
  ): Promise<InboxMessage | null> {
    return this.database.db.transaction(async (transaction) => {
      if (draftId) {
        const [draft] = await transaction
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
          .for('update')
          .limit(1);
        if (!draft) return null;
      }
      const [conversation] = await transaction
        .select({ channelConnectionId: conversations.channelConnectionId })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!conversation) return null;
      const occurredAt = new Date();
      const [message] = await transaction
        .insert(messages)
        .values({
          authorKind: 'agent',
          authorUserId: userId,
          body,
          channelConnectionId: conversation.channelConnectionId,
          conversationId,
          direction: 'outbound',
          externalMessageId,
          ...(draftId ? { metadata: { aiDraftId: draftId } } : {}),
          occurredAt,
          workspaceId,
        })
        .returning({
          authorKind: messages.authorKind,
          body: messages.body,
          direction: messages.direction,
          id: messages.id,
          occurredAt: messages.occurredAt,
        });
      if (!message) throw new Error('Unable to store the agent reply.');
      await transaction
        .update(conversations)
        .set({
          lastMessageAt: occurredAt,
          status: 'waiting_customer',
          updatedAt: occurredAt,
        })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.workspaceId, workspaceId),
          ),
        );
      await transaction
        .update(tickets)
        .set({
          firstResponseAt: sql`coalesce(${tickets.firstResponseAt}, ${occurredAt})`,
          status: 'waiting_customer',
          updatedAt: occurredAt,
        })
        .where(
          and(
            eq(tickets.conversationId, conversationId),
            eq(tickets.workspaceId, workspaceId),
          ),
        );
      if (draftId) {
        await transaction
          .update(aiDrafts)
          .set({
            finalBody: body,
            sentAt: occurredAt,
            sentByUserId: userId,
            status: 'sent',
            updatedAt: occurredAt,
          })
          .where(
            and(
              eq(aiDrafts.id, draftId),
              eq(aiDrafts.workspaceId, workspaceId),
              eq(aiDrafts.status, 'generated'),
            ),
          );
      }
      return message;
    });
  }

  async updateTicket(
    workspaceId: string,
    conversationId: string,
    input: TicketUpdate,
  ): Promise<InboxConversationSummary | null> {
    const now = new Date();
    const [ticket] = await this.database.db
      .update(tickets)
      .set({
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.status
          ? {
              resolvedAt: input.status === 'resolved' ? now : null,
              status: input.status,
            }
          : {}),
        updatedAt: now,
      })
      .where(
        and(
          eq(tickets.workspaceId, workspaceId),
          eq(tickets.conversationId, conversationId),
        ),
      )
      .returning({ id: tickets.id });
    if (!ticket) return null;
    if (input.status) {
      const conversationStatus =
        input.status === 'waiting_customer' ||
        input.status === 'waiting_agent' ||
        input.status === 'resolved' ||
        input.status === 'closed'
          ? input.status
          : 'open';
      await this.database.db
        .update(conversations)
        .set({ status: conversationStatus, updatedAt: now })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.workspaceId, workspaceId),
          ),
        );
    }
    return this.getInboxConversation(workspaceId, conversationId);
  }

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

      const [existingConversation] = await transaction
        .select({
          id: conversations.id,
          publicAccessTokenHash: conversations.publicAccessTokenHash,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.channelConnectionId, connection.id),
            eq(conversations.externalThreadId, input.externalThreadId),
          ),
        )
        .limit(1);

      if (
        existingConversation &&
        existingConversation.publicAccessTokenHash !==
          input.publicAccessTokenHash
      ) {
        return null;
      }

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

      let conversationId = existingConversation?.id;
      let ticketNumber: number;
      if (!conversationId) {
        const [conversation] = await transaction
          .insert(conversations)
          .values({
            channelConnectionId: connection.id,
            customerId,
            externalThreadId: input.externalThreadId,
            publicAccessTokenHash: input.publicAccessTokenHash,
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
