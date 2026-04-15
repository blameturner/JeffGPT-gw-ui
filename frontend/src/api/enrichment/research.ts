import { http } from '../../lib/http';
import type { ResearchPlansListResponse } from '../types/Enrichment';

export interface CreatePlanRequest {
  topic: string;
}

export interface AgentRunRequest {
  plan_id: number;
}

export function createResearchPlan(payload: CreatePlanRequest) {
  return http.post('enrichment/research/create-plan', { json: payload });
}

export function getNextResearchPlan() {
  return http.post('enrichment/research/get-next');
}

export function completeResearchPlan(planId: number) {
  return http.post('enrichment/research/complete', {
    searchParams: { plan_id: planId },
  });
}

export function runResearchAgent(payload: AgentRunRequest) {
  return http.post('enrichment/research/agent/run', { json: payload });
}

export function nextResearchAgent(payload?: AgentRunRequest) {
  return http.post('enrichment/research/agent/next', { json: payload ?? {} });
}

export function deleteResearchPlan(planId: number) {
  return http.post('enrichment/research/delete', { json: { plan_id: planId } });
}

export function updateResearchPlanQueries(planId: number, queries: string[]) {
  return http.post('enrichment/research/update', { json: { plan_id: planId, queries } });
}

export function listResearchPlans(params?: { status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  return http.get(`enrichment/research-plans/list?${searchParams}`).json<ResearchPlansListResponse>();
}