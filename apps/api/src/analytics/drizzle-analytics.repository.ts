import { Injectable } from '@nestjs/common';
import { sql } from '@suppline/database';

import { DatabaseService } from '../database/database.service';
import type { AnalyticsOverview, AnalyticsRepository } from './analytics.types';

interface TicketMetricsRow extends Record<string, unknown> {
  averageFirstResponseMinutes: number | null;
  closed: number;
  open: number;
  resolved: number;
  total: number;
  waitingAgent: number;
  waitingCustomer: number;
}

interface AiMetricsRow extends Record<string, unknown> {
  averageReadiness: number | null;
  draftsPrepared: number;
  escalatedDrafts: number;
  humanEditedSends: number;
  humanSentDrafts: number;
}

interface ChannelMetricRow extends Record<string, unknown> {
  channel: AnalyticsOverview['channels'][number]['channel'];
  tickets: number;
}

@Injectable()
export class DrizzleAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly database: DatabaseService) {}

  async overview(workspaceId: string): Promise<AnalyticsOverview> {
    const [ticketMetrics, aiMetrics, channelMetrics] = await Promise.all([
      this.database.db.execute<TicketMetricsRow>(sql`
        with first_responses as (
          select
            ticket.id,
            extract(epoch from (response.created_at - inbound.created_at)) / 60
              as response_minutes
          from tickets ticket
          join conversations conversation
            on conversation.id = ticket.conversation_id
            and conversation.workspace_id = ${workspaceId}
          join lateral (
            select message.created_at
            from messages message
            where message.conversation_id = conversation.id
              and message.workspace_id = ${workspaceId}
              and message.direction = 'inbound'
            order by message.created_at, message.id
            limit 1
          ) inbound on true
          left join lateral (
            select message.created_at
            from messages message
            where message.conversation_id = conversation.id
              and message.workspace_id = ${workspaceId}
              and message.direction = 'outbound'
              and message.created_at >= inbound.created_at
            order by message.created_at, message.id
            limit 1
          ) response on true
          where ticket.workspace_id = ${workspaceId}
            and ticket.created_at >= now() - interval '30 days'
        )
        select
          count(*)::integer as total,
          count(*) filter (where status = 'open')::integer as open,
          count(*) filter (where status = 'waiting_agent')::integer as "waitingAgent",
          count(*) filter (where status = 'waiting_customer')::integer as "waitingCustomer",
          count(*) filter (where status = 'resolved')::integer as resolved,
          count(*) filter (where status = 'closed')::integer as closed,
          (
            select round(avg(response_minutes)::numeric, 1)::double precision
            from first_responses
            where response_minutes is not null
          ) as "averageFirstResponseMinutes"
        from tickets
        where workspace_id = ${workspaceId}
          and created_at >= now() - interval '30 days'
      `),
      this.database.db.execute<AiMetricsRow>(sql`
        select
          count(*)::integer as "draftsPrepared",
          count(*) filter (where requires_human)::integer as "escalatedDrafts",
          count(*) filter (where status = 'sent')::integer as "humanSentDrafts",
          count(*) filter (
            where status = 'sent'
              and final_body is not null
              and btrim(final_body) <> btrim(body)
          )::integer as "humanEditedSends",
          round(avg(readiness_score)::numeric, 1)::double precision
            as "averageReadiness"
        from ai_drafts
        where workspace_id = ${workspaceId}
          and created_at >= now() - interval '30 days'
      `),
      this.database.db.execute<ChannelMetricRow>(sql`
        select connection.kind as channel, count(*)::integer as tickets
        from tickets ticket
        join conversations conversation
          on conversation.id = ticket.conversation_id
          and conversation.workspace_id = ${workspaceId}
        join channel_connections connection
          on connection.id = conversation.channel_connection_id
          and connection.workspace_id = ${workspaceId}
        where ticket.workspace_id = ${workspaceId}
          and ticket.created_at >= now() - interval '30 days'
        group by connection.kind
        order by tickets desc, connection.kind
      `),
    ]);

    const tickets = ticketMetrics.rows[0];
    const ai = aiMetrics.rows[0];
    if (!tickets || !ai) throw new Error('Analytics aggregation failed.');

    return { ai, channels: channelMetrics.rows, tickets, windowDays: 30 };
  }
}
