import { http } from '../../lib/http';

export interface RunQueueJobNowResponse {
  status: 'dispatched' | string;
  job_id?: string;
  type?: string;
  priority?: number;
  bypass_idle?: boolean;
  error?: string;
}

export function runQueueJobNow(jobId: string) {
  return http
    .post(`api/tool-queue/jobs/${encodeURIComponent(jobId)}/run-now`)
    .json<RunQueueJobNowResponse>();
}
