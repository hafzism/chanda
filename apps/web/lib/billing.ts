export interface BillingSummary {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  entitlement: 'free' | 'pro';
  graceEndsAt: string | null;
  status: string;
}

export function readBilling(workspaceId: string) {
  return apiRequest<BillingSummary>(`/workspaces/${workspaceId}/billing`, {
    cache: 'no-store',
  });
}

export function startCheckout(workspaceId: string) {
  return apiRequest<{ url: string }>(
    `/workspaces/${workspaceId}/billing/checkout`,
    { method: 'POST' },
  );
}

export function openBillingPortal(workspaceId: string) {
  return apiRequest<{ url: string }>(
    `/workspaces/${workspaceId}/billing/portal`,
    { method: 'POST' },
  );
}

import { apiRequest } from './api-client';
