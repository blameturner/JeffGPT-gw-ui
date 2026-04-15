import { http } from '../../lib/http';

export function cancelQueueJob(jobId: string) {
  return http.delete(`api/queue/jobs/${encodeURIComponent(jobId)}`).json<{ cancelled: boolean }>();
}
