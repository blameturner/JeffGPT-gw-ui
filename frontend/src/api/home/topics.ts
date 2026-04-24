import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { PATopic } from './types';

export function listTopics(orgId: number = defaultOrgId()) {
  return http
    .get('api/home/topics', { searchParams: { org_id: orgId } })
    .json<{ topics: PATopic[] }>();
}
