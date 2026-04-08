import { harnessClient } from './client.js';
import {
  HARNESS_CHAT_TIMEOUT_MS,
  HARNESS_CONVERSATIONS_TIMEOUT_MS,
  HARNESS_HEALTH_TIMEOUT_MS,
  HARNESS_MODELS_TIMEOUT_MS,
  HARNESS_RUN_TIMEOUT_MS,
} from '../../constants/timeouts.js';
import type { HarnessChatRequest, HarnessRunRequest } from '../../types/harness.js';

export function health(): Promise<Response> {
  return harnessClient.get('/health', HARNESS_HEALTH_TIMEOUT_MS);
}

export function listModels(): Promise<Response> {
  return harnessClient.get('/models', HARNESS_MODELS_TIMEOUT_MS);
}

export function run(payload: HarnessRunRequest): Promise<Response> {
  return harnessClient.post('/run', payload, HARNESS_RUN_TIMEOUT_MS);
}

export function chat(payload: HarnessChatRequest): Promise<Response> {
  return harnessClient.post('/chat', payload, HARNESS_CHAT_TIMEOUT_MS);
}

export function listAgents(orgId: number): Promise<Response> {
  return harnessClient.get(
    `/agents?org_id=${orgId}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function listConversations(orgId: number, limit = 50): Promise<Response> {
  return harnessClient.get(
    `/conversations?org_id=${orgId}&limit=${limit}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function getConversationMessages(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/conversations/${conversationId}/messages`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function getConversationSummary(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/conversations/${conversationId}/summary`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
