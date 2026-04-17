import { http } from '../../lib/http';
import type { OpsDashboardResponse } from '../types/OpsDashboard';

export function getEnrichmentDashboard(params: { org_id: number; limit?: number }) {
  const sp = new URLSearchParams();
  sp.set('org_id', String(params.org_id));
  if (params.limit != null) sp.set('limit', String(params.limit));
  return http.get(`api/enrichment/dashboard?${sp.toString()}`).json<{
    status: string;
    org_id: number;
    discovery?: OpsDashboardResponse['discovery'];
    scrape_targets?: OpsDashboardResponse['scrape_targets'];
    queue_jobs?: OpsDashboardResponse['queue_jobs'];
  }>();
}

