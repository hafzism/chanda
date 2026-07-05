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

export async function getAnalyticsOverview(workspaceId: string) {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/analytics/overview`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new Error(message ?? 'Analytics could not be loaded.');
  }
  return response.json() as Promise<AnalyticsOverview>;
}
