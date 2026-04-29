import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function updateConversation(
  conversationId: number,
  orgId: number,
  body: Record<string, unknown>,
): Promise<Response> {
  return harnessClient.patch(
    `/conversations/${conversationId}?org_id=${orgId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
