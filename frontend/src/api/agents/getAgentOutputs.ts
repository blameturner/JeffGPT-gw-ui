import { http } from '../../lib/http';
import type { AgentOutputRow } from '../types/AgentOutputRow';

export function getAgentOutputs(id: number) {
  return http
    .get(`agents/${id}/outputs`)
    .json<{ outputs: AgentOutputRow[]; page: number; limit: number; total: number }>();
}
