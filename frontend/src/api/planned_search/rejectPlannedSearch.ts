import { http } from '../../lib/http';
import type { PlannedSearchRejectResponse } from './types';

export function rejectPlannedSearch(messageId: number) {
  return http
    .post(`api/planned_search/${messageId}/reject`)
    .json<PlannedSearchRejectResponse>();
}
