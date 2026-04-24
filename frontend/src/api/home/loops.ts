import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { PALoop, LoopStatus } from './types';

export function listLoops(opts: { orgId?: number; status?: LoopStatus | 'any' } = {}) {
  const search: Record<string, string | number> = {
    org_id: opts.orgId ?? defaultOrgId(),
  };
  if (opts.status && opts.status !== 'any') search.status = opts.status;
  return http
    .get('api/home/loops', { searchParams: search })
    .json<{ loops: PALoop[] }>();
}

export function resolveLoop(id: number, opts: { note?: string; orgId?: number } = {}) {
  return http
    .post(`api/home/loops/${id}/resolve`, {
      json: { org_id: opts.orgId ?? defaultOrgId(), note: opts.note ?? '' },
    })
    .json<{ status: 'resolved' }>();
}

export function dropLoop(id: number, opts: { reason?: string; orgId?: number } = {}) {
  return http
    .post(`api/home/loops/${id}/drop`, {
      json: { org_id: opts.orgId ?? defaultOrgId(), reason: opts.reason ?? '' },
    })
    .json<{ status: 'dropped' }>();
}
