import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

const timestamps = {
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const workspaceRole = pgEnum('workspace_role', [
  'owner',
  'admin',
  'agent',
  'viewer',
]);

export const knowledgeSourceKind = pgEnum('knowledge_source_kind', [
  'file',
  'article',
]);

export const knowledgeVersionStatus = pgEnum('knowledge_version_status', [
  'queued',
  'processing',
  'ready',
  'failed',
]);

export const supportChannelKind = pgEnum('support_channel_kind', [
  'web',
  'telegram',
  'whatsapp',
  'gmail',
  'facebook',
  'instagram',
]);

export const channelConnectionStatus = pgEnum('channel_connection_status', [
  'active',
  'disconnected',
  'error',
]);

export const conversationStatus = pgEnum('conversation_status', [
  'open',
  'waiting_customer',
  'waiting_agent',
  'resolved',
  'closed',
]);

export const messageDirection = pgEnum('message_direction', [
  'inbound',
  'outbound',
]);

export const messageAuthorKind = pgEnum('message_author_kind', [
  'customer',
  'agent',
  'ai',
  'system',
]);

export const ticketStatus = pgEnum('ticket_status', [
  'open',
  'ai_replied',
  'escalated',
  'waiting_customer',
  'waiting_agent',
  'resolved',
  'closed',
]);

export const ticketPriority = pgEnum('ticket_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const aiDraftStatus = pgEnum('ai_draft_status', [
  'generated',
  'sent',
  'superseded',
]);

export const billingSubscriptionStatus = pgEnum('billing_subscription_status', [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]);

export interface StoredAiDraftCitation {
  characterEnd: number;
  characterStart: number;
  content: string;
  documentId: string;
  heading: string | null;
  keywordRank: number | null;
  semanticRank: number | null;
  title: string;
  versionId: string;
}

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firebaseUid: text('firebase_uid').notNull(),
    email: citext('email').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    lastSignedInAt: timestamp('last_signed_in_at', {
      mode: 'date',
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_firebase_uid_unique').on(table.firebaseUid),
    uniqueIndex('users_email_unique').on(table.email),
  ],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: citext('slug').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('workspaces_slug_unique').on(table.slug),
    index('workspaces_created_by_idx').on(table.createdByUserId),
  ],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull(),
    joinedAt: timestamp('joined_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    uniqueIndex('workspace_members_one_owner')
      .on(table.workspaceId)
      .where(sql`${table.role} = 'owner'`),
    index('workspace_members_user_idx').on(table.userId),
  ],
);

export const workspaceBillingAccounts = pgTable(
  'workspace_billing_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    subscriptionStatus: billingSubscriptionStatus('subscription_status'),
    currentPeriodEnd: timestamp('current_period_end', {
      mode: 'date',
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    latestStripeEventCreatedAt: timestamp('latest_stripe_event_created_at', {
      mode: 'date',
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('workspace_billing_accounts_workspace_unique').on(
      table.workspaceId,
    ),
    uniqueIndex('workspace_billing_accounts_customer_unique').on(
      table.stripeCustomerId,
    ),
    uniqueIndex('workspace_billing_accounts_subscription_unique')
      .on(table.stripeSubscriptionId)
      .where(sql`${table.stripeSubscriptionId} is not null`),
  ],
);

export const stripeWebhookEvents = pgTable(
  'stripe_webhook_events',
  {
    eventId: text('event_id').primaryKey(),
    eventType: text('event_type').notNull(),
    eventCreatedAt: timestamp('event_created_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    processedAt: timestamp('processed_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('stripe_webhook_events_workspace_idx').on(table.workspaceId),
    index('stripe_webhook_events_created_idx').on(table.eventCreatedAt),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
    ipHash: char('ip_hash', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: citext('email').notNull(),
    role: workspaceRole('role').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    acceptedAt: timestamp('accepted_at', {
      mode: 'date',
      withTimezone: true,
    }),
    revokedAt: timestamp('revoked_at', {
      mode: 'date',
      withTimezone: true,
    }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    check(
      'workspace_invitations_role_not_owner',
      sql`${table.role} <> 'owner'`,
    ),
    uniqueIndex('workspace_invitations_token_hash_unique').on(table.tokenHash),
    uniqueIndex('workspace_invitations_pending_email_unique')
      .on(table.workspaceId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index('workspace_invitations_workspace_idx').on(table.workspaceId),
  ],
);

export const knowledgeDocuments = pgTable(
  'knowledge_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sourceKind: knowledgeSourceKind('source_kind').notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [
    index('knowledge_documents_workspace_idx').on(table.workspaceId),
    index('knowledge_documents_creator_idx').on(table.createdByUserId),
  ],
);

export const knowledgeDocumentVersions = pgTable(
  'knowledge_document_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    originalFilename: text('original_filename'),
    mimeType: text('mime_type').notNull(),
    objectKey: text('object_key').notNull(),
    extractedObjectKey: text('extracted_object_key'),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    byteSize: integer('byte_size').notNull(),
    status: knowledgeVersionStatus('status').default('queued').notNull(),
    chunkCount: integer('chunk_count').default(0).notNull(),
    embeddingProvider: text('embedding_provider'),
    embeddingModel: text('embedding_model'),
    embeddingDimensions: integer('embedding_dimensions'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    indexedAt: timestamp('indexed_at', { mode: 'date', withTimezone: true }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('knowledge_versions_document_version_unique').on(
      table.documentId,
      table.version,
    ),
    uniqueIndex('knowledge_versions_workspace_content_unique').on(
      table.workspaceId,
      table.contentHash,
    ),
    index('knowledge_versions_workspace_status_idx').on(
      table.workspaceId,
      table.status,
    ),
    index('knowledge_versions_document_idx').on(table.documentId),
  ],
);

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    documentVersionId: uuid('document_version_id')
      .notNull()
      .references(() => knowledgeDocumentVersions.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    heading: text('heading'),
    content: text('content').notNull(),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    estimatedTokenCount: integer('estimated_token_count').notNull(),
    pageNumber: integer('page_number'),
    characterStart: integer('character_start').notNull(),
    characterEnd: integer('character_end').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('knowledge_chunks_version_ordinal_unique').on(
      table.documentVersionId,
      table.ordinal,
    ),
    index('knowledge_chunks_workspace_idx').on(table.workspaceId),
    index('knowledge_chunks_document_idx').on(table.documentId),
    index('knowledge_chunks_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    attempts: integer('attempts').default(0).notNull(),
    availableAt: timestamp('available_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', {
      mode: 'date',
      withTimezone: true,
    }),
    lastError: text('last_error'),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('outbox_events_topic_aggregate_unique')
      .on(table.topic, table.aggregateId)
      .where(sql`${table.publishedAt} is null`),
    index('outbox_events_pending_idx')
      .on(table.availableAt, table.createdAt)
      .where(sql`${table.publishedAt} is null`),
    index('outbox_events_workspace_idx').on(table.workspaceId),
  ],
);

export const channelConnections = pgTable(
  'channel_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: supportChannelKind('kind').notNull(),
    status: channelConnectionStatus('status').default('active').notNull(),
    name: text('name').notNull(),
    publicKey: text('public_key'),
    allowedOrigins: text('allowed_origins')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    settings: jsonb('settings')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    lastInboundAt: timestamp('last_inbound_at', {
      mode: 'date',
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('channel_connections_workspace_kind_unique').on(
      table.workspaceId,
      table.kind,
    ),
    uniqueIndex('channel_connections_public_key_unique')
      .on(table.publicKey)
      .where(sql`${table.publicKey} is not null`),
    index('channel_connections_workspace_idx').on(table.workspaceId),
  ],
);

export const channelConnectionSecrets = pgTable(
  'channel_connection_secrets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    channelConnectionId: uuid('channel_connection_id')
      .notNull()
      .references(() => channelConnections.id, { onDelete: 'cascade' }),
    encryptedCredentials: text('encrypted_credentials').notNull(),
    encryptionKeyVersion: integer('encryption_key_version')
      .default(1)
      .notNull(),
    webhookSecretHash: char('webhook_secret_hash', { length: 64 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('channel_connection_secrets_connection_unique').on(
      table.channelConnectionId,
    ),
    index('channel_connection_secrets_workspace_idx').on(table.workspaceId),
  ],
);

export const oauthConnectionStates = pgTable(
  'oauth_connection_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stateHash: char('state_hash', { length: 64 }).notNull(),
    provider: text('provider').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    usedAt: timestamp('used_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('oauth_connection_states_hash_unique').on(table.stateHash),
    index('oauth_connection_states_expiry_idx').on(table.expiresAt),
    index('oauth_connection_states_workspace_idx').on(table.workspaceId),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    email: citext('email'),
    ...timestamps,
  },
  (table) => [
    index('customers_workspace_idx').on(table.workspaceId),
    index('customers_workspace_email_idx').on(table.workspaceId, table.email),
  ],
);

export const customerChannelIdentities = pgTable(
  'customer_channel_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    channelConnectionId: uuid('channel_connection_id')
      .notNull()
      .references(() => channelConnections.id, { onDelete: 'cascade' }),
    externalCustomerId: text('external_customer_id').notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('customer_identities_connection_external_unique').on(
      table.channelConnectionId,
      table.externalCustomerId,
    ),
    index('customer_identities_workspace_customer_idx').on(
      table.workspaceId,
      table.customerId,
    ),
  ],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    channelConnectionId: uuid('channel_connection_id')
      .notNull()
      .references(() => channelConnections.id, { onDelete: 'restrict' }),
    externalThreadId: text('external_thread_id').notNull(),
    publicAccessTokenHash: char('public_access_token_hash', { length: 64 }),
    subject: text('subject'),
    status: conversationStatus('status').default('open').notNull(),
    lastMessageAt: timestamp('last_message_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('conversations_connection_thread_unique').on(
      table.channelConnectionId,
      table.externalThreadId,
    ),
    index('conversations_workspace_activity_idx').on(
      table.workspaceId,
      table.lastMessageAt,
    ),
    index('conversations_workspace_status_idx').on(
      table.workspaceId,
      table.status,
    ),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    channelConnectionId: uuid('channel_connection_id')
      .notNull()
      .references(() => channelConnections.id, { onDelete: 'restrict' }),
    externalMessageId: text('external_message_id'),
    direction: messageDirection('direction').notNull(),
    authorKind: messageAuthorKind('author_kind').notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('messages_connection_external_unique')
      .on(table.channelConnectionId, table.externalMessageId)
      .where(sql`${table.externalMessageId} is not null`),
    index('messages_workspace_conversation_time_idx').on(
      table.workspaceId,
      table.conversationId,
      table.occurredAt,
    ),
  ],
);

export const workspaceTicketSequences = pgTable('workspace_ticket_sequences', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  nextNumber: integer('next_number').default(1).notNull(),
});

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    number: integer('number').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    status: ticketStatus('status').default('open').notNull(),
    priority: ticketPriority('priority').default('normal').notNull(),
    assignedUserId: uuid('assigned_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    summary: text('summary'),
    category: text('category'),
    escalationReason: text('escalation_reason'),
    firstResponseAt: timestamp('first_response_at', {
      mode: 'date',
      withTimezone: true,
    }),
    resolvedAt: timestamp('resolved_at', {
      mode: 'date',
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('tickets_workspace_number_unique').on(
      table.workspaceId,
      table.number,
    ),
    uniqueIndex('tickets_conversation_unique').on(table.conversationId),
    index('tickets_workspace_status_updated_idx').on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    index('tickets_workspace_assignee_idx').on(
      table.workspaceId,
      table.assignedUserId,
    ),
  ],
);

export const ticketNotes = pgTable(
  'ticket_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('ticket_notes_workspace_ticket_idx').on(
      table.workspaceId,
      table.ticketId,
      table.createdAt,
    ),
  ],
);

export const aiDrafts = pgTable(
  'ai_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    inputMessageId: uuid('input_message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'restrict' }),
    status: aiDraftStatus('status').default('generated').notNull(),
    body: text('body').notNull(),
    finalBody: text('final_body'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    retrievalMode: text('retrieval_mode').notNull(),
    readinessScore: integer('readiness_score').notNull(),
    requiresHuman: boolean('requires_human').notNull(),
    escalationReason: text('escalation_reason'),
    citations: jsonb('citations')
      .$type<StoredAiDraftCitation[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sentByUserId: uuid('sent_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sentAt: timestamp('sent_at', { mode: 'date', withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('ai_drafts_workspace_ticket_created_idx').on(
      table.workspaceId,
      table.ticketId,
      table.createdAt,
    ),
    index('ai_drafts_workspace_status_idx').on(table.workspaceId, table.status),
  ],
);

export const retrievalEvaluationCases = pgTable(
  'retrieval_evaluation_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    expectedDocumentId: uuid('expected_document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('retrieval_evaluation_cases_workspace_question_unique').on(
      table.workspaceId,
      table.question,
    ),
    index('retrieval_evaluation_cases_workspace_idx').on(table.workspaceId),
  ],
);

export const retrievalEvaluationRuns = pgTable(
  'retrieval_evaluation_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    caseCount: integer('case_count').notNull(),
    hitCount: integer('hit_count').notNull(),
    hitRate: doublePrecision('hit_rate').notNull(),
    meanReciprocalRank: doublePrecision('mean_reciprocal_rank').notNull(),
    hybridCaseCount: integer('hybrid_case_count').notNull(),
    keywordOnlyCaseCount: integer('keyword_only_case_count').notNull(),
    topK: integer('top_k').notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('retrieval_evaluation_runs_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const retrievalEvaluationResults = pgTable(
  'retrieval_evaluation_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => retrievalEvaluationRuns.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id').references(() => retrievalEvaluationCases.id, {
      onDelete: 'set null',
    }),
    questionSnapshot: text('question_snapshot').notNull(),
    expectedDocumentId: uuid('expected_document_id').references(
      () => knowledgeDocuments.id,
      { onDelete: 'set null' },
    ),
    expectedDocumentTitle: text('expected_document_title').notNull(),
    retrievedDocumentIds: jsonb('retrieved_document_ids')
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    retrievalMode: text('retrieval_mode').notNull(),
    reciprocalRank: doublePrecision('reciprocal_rank').notNull(),
    wasHit: boolean('was_hit').notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('retrieval_evaluation_results_run_idx').on(table.runId),
    index('retrieval_evaluation_results_workspace_idx').on(table.workspaceId),
  ],
);
