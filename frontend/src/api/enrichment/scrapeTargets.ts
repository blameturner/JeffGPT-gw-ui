import { http } from '../../lib/http';
import type { ScrapeTargetRow } from '../types/Enrichment';

export interface ListScrapeTargetsParams {
  status?: string;
  active_only?: boolean;
  limit?: number;
}

export interface ListScrapeTargetsResponse {
  status: string;
  rows: ScrapeTargetRow[];
}

export function listScrapeTargets(params?: ListScrapeTargetsParams) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only));
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const url = qs
    ? `api/enrichment/scrape-targets/list?${qs}`
    : 'api/enrichment/scrape-targets/list';
  return http.get(url).json<ListScrapeTargetsResponse>();
}
