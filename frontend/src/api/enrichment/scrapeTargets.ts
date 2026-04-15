import { http } from '../../lib/http';
import type { ScrapeTargetRow } from '../types/Enrichment';
import { normalizeList } from './_normalizeList';

export interface ListScrapeTargetsParams {
  status?: string;
  active_only?: boolean;
  limit?: number;
}

export interface ListScrapeTargetsResponse {
  status: string;
  rows: ScrapeTargetRow[];
}

export async function listScrapeTargets(
  params?: ListScrapeTargetsParams,
): Promise<ListScrapeTargetsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only));
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const url = qs
    ? `api/enrichment/scrape-targets/list?${qs}`
    : 'api/enrichment/scrape-targets/list';
  const raw = await http.get(url).json<unknown>();
  const normalized = normalizeList<ScrapeTargetRow>(raw, 'scrape-targets/list');
  const status =
    raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).status === 'string'
      ? ((raw as Record<string, unknown>).status as string)
      : 'ok';
  return { status, rows: normalized.items };
}
