import { http } from '../../lib/http';
import type { AgentSummary } from '../types/AgentSummary';

export function getAgent(id: number) {
  return http.get(`agents/${id}`).json<AgentSummary>();
}
