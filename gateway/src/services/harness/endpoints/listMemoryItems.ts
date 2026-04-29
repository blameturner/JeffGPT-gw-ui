import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function listMemoryItems(
  conversationId: number,
  orgId: number,
  query: { status?: string; category?: string; pinned_only?: boolean } = {},
): Promise<Response> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (query.status) params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  if (query.pinned_only != null) params.set('pinned_only', String(query.pinned_only));
  return harnessClient.get(
    `/conversations/${conversationId}/memory?${params.toString()}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function createMemoryItem(
  conversationId: number,
  orgId: number,
  body: Record<string, unknown>,
): Promise<Response> {
  return harnessClient.post(
    `/conversations/${conversationId}/memory?org_id=${orgId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function updateMemoryItem(
  conversationId: number,
  orgId: number,
  itemId: number,
  body: Record<string, unknown>,
): Promise<Response> {
  return harnessClient.patch(
    `/conversations/${conversationId}/memory/${itemId}?org_id=${orgId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function deleteMemoryItem(
  conversationId: number,
  orgId: number,
  itemId: number,
): Promise<Response> {
  return harnessClient.delete(
    `/conversations/${conversationId}/memory/${itemId}?org_id=${orgId}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function extractMemory(conversationId: number, orgId: number): Promise<Response> {
  return harnessClient.post(
    `/conversations/${conversationId}/memory/extract?org_id=${orgId}`,
    {},
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
