import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { PAFact } from './types';

export function listFacts(orgId: number = defaultOrgId()) {
  return http
    .get('api/home/facts', { searchParams: { org_id: orgId } })
    .json<{ facts: PAFact[] }>();
}

export function deleteFact(id: number, orgId: number = defaultOrgId()) {
  return http
    .delete(`api/home/facts/${id}`, { searchParams: { org_id: orgId } })
    .json<{ status: 'deleted' }>();
}
