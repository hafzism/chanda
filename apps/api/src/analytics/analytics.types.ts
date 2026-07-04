export interface AnalyticsOverview {
  ai: {
    averageReadiness: number | null;
    draftsPrepared: number;
    escalatedDrafts: number;
    humanEditedSends: number;
    humanSentDrafts: number;
  };
  channels: Array<{
    channel: 'web' | 'telegram' | 'whatsapp' | 'gmail';
    tickets: number;
  }>;
  tickets: {
    averageFirstResponseMinutes: number | null;
    closed: number;
    open: number;
    resolved: number;
    total: number;
    waitingAgent: number;
    waitingCustomer: number;
  };
  windowDays: 30;
}

export interface AnalyticsRepository {
  overview(workspaceId: string): Promise<AnalyticsOverview>;
}
