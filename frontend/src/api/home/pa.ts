import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { PAStatus, PARunResponse } from './types';

export function getPAStatus(orgId: number = defaultOrgId()) {
  return http
    .get('api/home/pa/status', { searchParams: { org_id: orgId } })
    .json<PAStatus>();
}

export function runPA(opts: { force?: boolean; orgId?: number } = {}) {
  return http
    .post('api/home/pa/run', {
      json: {
        org_id: opts.orgId ?? defaultOrgId(),
        force: opts.force ?? true,
      },
    })
    .json<PARunResponse>();
}
