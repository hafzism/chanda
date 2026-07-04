import { describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '../src/analytics/analytics.service';
import type { AnalyticsOverview } from '../src/analytics/analytics.types';

describe('AnalyticsService', () => {
  it('returns the repository aggregation without inventing absent metrics', async () => {
    const overview: AnalyticsOverview = {
      ai: {
        averageReadiness: 72.5,
        draftsPrepared: 4,
        escalatedDrafts: 2,
        humanEditedSends: 1,
        humanSentDrafts: 3,
      },
      channels: [{ channel: 'web', tickets: 6 }],
      tickets: {
        averageFirstResponseMinutes: 8.4,
        closed: 1,
        open: 2,
        resolved: 1,
        total: 6,
        waitingAgent: 1,
        waitingCustomer: 1,
      },
      windowDays: 30,
    };
    const repository = { overview: vi.fn().mockResolvedValue(overview) };
    const service = new AnalyticsService(repository);

    await expect(service.overview('workspace-1')).resolves.toBe(overview);
    expect(repository.overview).toHaveBeenCalledWith('workspace-1');
    expect(overview).not.toHaveProperty('estimatedCost');
    expect(overview).not.toHaveProperty('resolvedByAi');
  });
});
