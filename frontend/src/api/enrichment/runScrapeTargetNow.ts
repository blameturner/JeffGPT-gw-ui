import { http } from '../../lib/http';

export interface RunScrapeTargetNowResponse {
  status: 'queued' | 'failed' | string;
  target_id?: number;
  job_id?: string;
  org_id?: number;
  error?: string;
}

export function runScrapeTargetNow(targetId: number | string) {
  return http
    .post(`api/enrichment/scrape-targets/${encodeURIComponent(String(targetId))}/run-now`)
    .json<RunScrapeTargetNowResponse>();
}
