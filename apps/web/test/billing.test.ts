import { afterEach, describe, expect, it, vi } from 'vitest';
import { openBillingPortal, readBilling, startCheckout } from '../lib/billing';

describe('billing operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads workspace entitlement and starts hosted Stripe actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entitlement: 'free',
            graceEndsAt: null,
            status: 'free',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://checkout.stripe.test' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://portal.stripe.test' }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(readBilling('workspace-1')).resolves.toMatchObject({
      entitlement: 'free',
    });
    await expect(startCheckout('workspace-1')).resolves.toEqual({
      url: 'https://checkout.stripe.test',
    });
    await expect(openBillingPortal('workspace-1')).resolves.toEqual({
      url: 'https://portal.stripe.test',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/workspaces/workspace-1/billing',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/workspaces/workspace-1/billing/checkout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/workspaces/workspace-1/billing/portal',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
