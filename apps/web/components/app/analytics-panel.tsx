'use client';

import { Activity, Bot, Clock3, RefreshCw, TicketCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  getAnalyticsOverview,
  type AnalyticsOverview,
} from '../../lib/analytics';
import { RetrievalEvaluationPanel } from './retrieval-evaluation-panel';

export function AnalyticsPanel({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [overview, setOverview] = useState<AnalyticsOverview>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setOverview(await getAnalyticsOverview(workspaceId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load analytics.',
      );
    }
  }, [workspaceId]);

  useEffect(() => void load(), [load]);

  if (!overview && !error) {
    return (
      <section aria-live="polite" className="analytics-loading">
        <RefreshCw aria-hidden="true" size={20} />
        <p>Calculating workspace activity…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="analytics-failed" role="alert">
        <Activity size={26} />
        <h2>Analytics are temporarily unavailable</h2>
        <p>{error}</p>
        <button
          className="button secondary-button"
          onClick={() => void load()}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }

  const escalationRate = percent(
    overview.ai.escalatedDrafts,
    overview.ai.draftsPrepared,
  );
  const approvalRate = percent(
    overview.ai.humanSentDrafts,
    overview.ai.draftsPrepared,
  );
  const editRate = percent(
    overview.ai.humanEditedSends,
    overview.ai.humanSentDrafts,
  );
  const maxChannelTickets = Math.max(
    1,
    ...overview.channels.map(({ tickets }) => tickets),
  );

  return (
    <section className="analytics-panel">
      <div className="analytics-context">
        <span>Last {overview.windowDays} days</span>
        <p>
          Live operational data. Readiness is a deterministic evidence score,
          not model confidence.
        </p>
      </div>

      <div className="analytics-metrics">
        <article>
          <span>
            <TicketCheck size={18} />
          </span>
          <p>Total tickets</p>
          <strong>{overview.tickets.total}</strong>
          <small>
            {overview.tickets.resolved + overview.tickets.closed} resolved or
            closed
          </small>
        </article>
        <article>
          <span>
            <Clock3 size={18} />
          </span>
          <p>First response</p>
          <strong>
            {formatMinutes(overview.tickets.averageFirstResponseMinutes)}
          </strong>
          <small>Average where a human reply exists</small>
        </article>
        <article>
          <span>
            <Bot size={18} />
          </span>
          <p>AI drafts prepared</p>
          <strong>{overview.ai.draftsPrepared}</strong>
          <small>
            {overview.ai.humanSentDrafts} explicitly sent by a human
          </small>
        </article>
        <article>
          <span>
            <Activity size={18} />
          </span>
          <p>Average readiness</p>
          <strong>
            {overview.ai.averageReadiness === null
              ? '—'
              : `${overview.ai.averageReadiness}%`}
          </strong>
          <small>Evidence and risk policy result</small>
        </article>
      </div>

      {overview.tickets.total === 0 && overview.ai.draftsPrepared === 0 ? (
        <div className="analytics-empty">
          <Activity size={24} />
          <h2>No activity in this window</h2>
          <p>
            Tickets, replies, and AI draft decisions will appear here after the
            workspace handles support conversations.
          </p>
        </div>
      ) : (
        <div className="analytics-detail-grid">
          <article>
            <header>
              <div>
                <span>Operations</span>
                <h2>Ticket state</h2>
              </div>
              <strong>{overview.tickets.total} total</strong>
            </header>
            <MetricRow
              label="Open"
              value={overview.tickets.open}
              total={overview.tickets.total}
            />
            <MetricRow
              label="Waiting for agent"
              value={overview.tickets.waitingAgent}
              total={overview.tickets.total}
            />
            <MetricRow
              label="Waiting for customer"
              value={overview.tickets.waitingCustomer}
              total={overview.tickets.total}
            />
            <MetricRow
              label="Resolved or closed"
              value={overview.tickets.resolved + overview.tickets.closed}
              total={overview.tickets.total}
            />
          </article>
          <article>
            <header>
              <div>
                <span>Channels</span>
                <h2>Ticket mix</h2>
              </div>
            </header>
            {overview.channels.map(({ channel, tickets }) => (
              <MetricRow
                key={channel}
                label={channelLabel(channel)}
                value={tickets}
                total={maxChannelTickets}
              />
            ))}
            {overview.channels.length === 0 && (
              <p className="analytics-inline-empty">
                No channel tickets in this window.
              </p>
            )}
          </article>
          <article className="analytics-ai-card">
            <header>
              <div>
                <span>AI review</span>
                <h2>Human control</h2>
              </div>
            </header>
            <div className="analytics-ai-rates">
              <div>
                <strong>{escalationRate}</strong>
                <span>Escalated drafts</span>
              </div>
              <div>
                <strong>{approvalRate}</strong>
                <span>Human-sent drafts</span>
              </div>
              <div>
                <strong>{editRate}</strong>
                <span>Edited before send</span>
              </div>
            </div>
            <p>
              These rates describe draft workflow only. Suppline does not
              auto-send AI replies in the current policy.
            </p>
          </article>
        </div>
      )}
      <RetrievalEvaluationPanel
        canManage={canManage}
        workspaceId={workspaceId}
      />
    </section>
  );
}

function MetricRow({
  label,
  total,
  value,
}: {
  label: string;
  total: number;
  value: number;
}) {
  const width = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="analytics-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span>
        <i style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

function percent(value: number, total: number) {
  return total === 0 ? '—' : `${Math.round((value / total) * 100)}%`;
}

function formatMinutes(value: number | null) {
  if (value === null) return '—';
  if (value < 60) return `${value}m`;
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}

function channelLabel(
  channel: AnalyticsOverview['channels'][number]['channel'],
) {
  return {
    gmail: 'Gmail',
    telegram: 'Telegram',
    web: 'Web chat',
    whatsapp: 'WhatsApp',
  }[channel];
}
