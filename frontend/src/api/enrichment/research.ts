import { http } from '../../lib/http';
import type { ResearchPlan, ResearchPlansListResponse } from '../types/Enrichment';
import { normalizeList } from './_normalizeList';

export interface CreatePlanRequest {
  topic: string;
}

export interface AgentRunRequest {
  plan_id: number;
}

/** Response shape for the async research-plan creation endpoint. */
export interface CreateResearchPlanResponse {
  status: 'queued';
  plan_id: number;
  job_id: string;
}

export function createResearchPlan(payload: CreatePlanRequest) {
  return http
    .post('api/enrichment/research/create-plan', { json: payload })
    .json<CreateResearchPlanResponse>();
}

export function getNextResearchPlan() {
  return http.post('api/enrichment/research/get-next');
}

export function completeResearchPlan(planId: number) {
  return http.post('api/enrichment/research/complete', {
    json: { plan_id: planId },
  });
}

export function runResearchAgent(payload: AgentRunRequest) {
  return http.post('api/enrichment/research/agent/run', { json: payload });
}

export function nextResearchAgent(payload?: AgentRunRequest) {
  return http.post('api/enrichment/research/agent/next', { json: payload ?? {} });
}

export function deleteResearchPlan(_planId: number): Promise<void> {
  // No backend endpoint; callers rendered as disabled. Kept for signature stability.
  // eslint-disable-next-line no-console
  console.warn('[research] deleteResearchPlan: no backend endpoint; no-op');
  return Promise.resolve();
}

export function updateResearchPlanQueries(_planId: number, _queries: string[]): Promise<void> {
  // No backend endpoint; callers rendered as disabled. Kept for signature stability.
  // eslint-disable-next-line no-console
  console.warn('[research] updateResearchPlanQueries: no backend endpoint; no-op');
  return Promise.resolve();
}

export async function listResearchPlans(params?: { status?: string }): Promise<ResearchPlansListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  const raw = await http.get(`api/enrichment/research-plans/list?${searchParams}`).json<unknown>();
  return normalizeList<ResearchPlan>(raw, 'research-plans/list') as ResearchPlansListResponse;
}

export function getResearchPlan(planId: number) {
  return http.get(`api/enrichment/research-plans/${planId}`).json<ResearchPlan>();
}
