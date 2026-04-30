// /ops page API client. (Note: a different `api/ops/` directory exists for the
// existing OpsDashboard; this file lives here to keep the new page's contract
// independent — the route uses the documented public endpoints listed below.)
import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';

export interface OpsConnector {
  id: string;
  name: string;
  kind: string;
  status: 'ok' | 'degraded' | 'error' | string;
  last_call_at?: string;
  error_count_24h?: number;
}
export interface OpsConnectorCall {
  id: string;
  ts: string;
  endpoint: string;
  duration_ms: number;
  ok: boolean;
  status_code?: number;
  error?: string;
}

export interface OpsScheduledJob {
  id: string;
  name: string;
  cron?: string;
  next_fire_at?: string;
  last_run_at?: string;
  paused?: boolean;
  kind?: string;
}
export interface OpsScheduledJobHistoryRow {
  id: string;
  ts: string;
  duration_ms?: number;
  ok: boolean;
  message?: string;
}

export interface OpsResearchArtifact {
  id: string;
  plan_id: string;
  plan_title?: string;
  title: string;
  kind?: string;
  created_at: string;
  url?: string;
  summary?: string;
}
export interface OpsResearchArtifactDetail extends OpsResearchArtifact {
  body?: string;
  citations?: Array<{ id: string; url?: string; title?: string }>;
}

const orgParam = () => ({ org_id: defaultOrgId() });

export const opsPageApi = {
  connectors: () =>
    http.get('api/connectors', { searchParams: orgParam() }).json<{ connectors: OpsConnector[] }>(),
  connectorCalls: (id: string, limit = 50) =>
    http
      .get(`api/connectors/${encodeURIComponent(id)}/calls`, { searchParams: { ...orgParam(), limit } })
      .json<{ calls: OpsConnectorCall[] }>(),
  connectorTest: (id: string) =>
    http
      .post(`api/connectors/${encodeURIComponent(id)}/test`, { json: orgParam() })
      .json<{ job_id?: string; ok: boolean }>(),

  scheduledJobs: () =>
    http.get('api/scheduler/jobs', { searchParams: orgParam() }).json<{ jobs: OpsScheduledJob[] }>(),
  scheduledJobHistory: (id: string, limit = 50) =>
    http
      .get(`api/scheduler/jobs/${encodeURIComponent(id)}/history`, {
        searchParams: { ...orgParam(), limit },
      })
      .json<{ runs: OpsScheduledJobHistoryRow[] }>(),
  scheduledJobRunNow: (id: string) =>
    http
      .post(`api/scheduler/jobs/${encodeURIComponent(id)}/run-now`, { json: orgParam() })
      .json<{ job_id?: string; ok: boolean }>(),
  scheduledJobPause: (id: string) =>
    http.post(`api/scheduler/jobs/${encodeURIComponent(id)}/pause`, { json: orgParam() }).json<{ ok: boolean }>(),
  scheduledJobResume: (id: string) =>
    http.post(`api/scheduler/jobs/${encodeURIComponent(id)}/resume`, { json: orgParam() }).json<{ ok: boolean }>(),

  researchArtifacts: (limit = 200) =>
    http
      .get('api/research/artifacts', { searchParams: { ...orgParam(), limit } })
      .json<{ artifacts: OpsResearchArtifact[] }>(),
  researchArtifact: (id: string) =>
    http
      .get(`api/research/artifacts/${encodeURIComponent(id)}`, { searchParams: orgParam() })
      .json<OpsResearchArtifactDetail>(),
};
