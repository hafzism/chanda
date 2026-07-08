export interface BillingSummary {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  entitlement: 'free' | 'pro';
  graceEndsAt: string | null;
  status: string;
}

export function readBilling(workspaceId: string) {
  return billingRequest<BillingSummary>(`/workspaces/${workspaceId}/billing`);
}

export function startCheckout(workspaceId: string) {
  return billingRequest<{ url: string }>(
    `/workspaces/${workspaceId}/billing/checkout`,
    { method: 'POST' },
  );
}

export function openBillingPortal(workspaceId: string) {
  return billingRequest<{ url: string }>(
    `/workspaces/${workspaceId}/billing/portal`,
    { method: 'POST' },
  );
}

async function billingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    cache: 'no-store',
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : body?.message;
    throw new Error(message ?? 'Unable to complete the billing request.');
  }
  return response.json() as Promise<T>;
}
