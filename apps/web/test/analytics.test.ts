import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAnalyticsOverview } from '../lib/analytics';

describe('analytics operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads a tenant-scoped live overview', async () => {
    const overview = {
      ai: {
        averageReadiness: null,
        draftsPrepared: 0,
        escalatedDrafts: 0,
        humanEditedSends: 0,
        humanSentDrafts: 0,
      },
      channels: [],
      tickets: {
        averageFirstResponseMinutes: null,
        closed: 0,
        open: 0,
        resolved: 0,
        total: 0,
        waitingAgent: 0,
        waitingCustomer: 0,
      },
      windowDays: 30,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(overview), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAnalyticsOverview('workspace-1')).resolves.toEqual(
      overview,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/workspaces/workspace-1/analytics/overview',
    );
  });
});
