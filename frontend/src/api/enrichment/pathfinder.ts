import { http } from '../../lib/http';
import type { DiscoveryListResponse } from '../types/Enrichment';
import type { ChainKickResponse } from './chainKick';

export interface DiscoverRequest {
  seed_url: string;
  max_depth?: number;
}

/** Response shape for the now-async pathfinder discover endpoint. */
export interface PathfinderDiscoverResponse {
  status: 'queued';
  discovery_id: number;
  job_id: string;
}

export function discover(payload: DiscoverRequest) {
  // TODO Cycle 3: UI polling for the queued discovery_id / job_id.
  return http
    .post('api/enrichment/pathfinder/discover', { json: payload })
    .json<PathfinderDiscoverResponse>();
}

export function fetchNextUrl() {
  return http.post('api/enrichment/pathfinder/fetch-next');
}

export function markUrlProcessed(urlId: number) {
  return http.post('api/enrichment/pathfinder/mark-processed', {
    json: { url_id: urlId },
  });
}

export function listDiscovery(params?: { status?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  return http.get(`api/enrichment/discovery/list?${searchParams}`).json<DiscoveryListResponse>();
}

/** Alias of the shared chain-kick response used by pathfinder start. */
export type PathfinderStartResponse = ChainKickResponse;

export function startPathfinder() {
  return http
    .post('api/enrichment/pathfinder/start')
    .json<PathfinderStartResponse>();
}
