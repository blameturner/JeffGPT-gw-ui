import { http } from '../../lib/http';

export function deleteSchedule(id: number) {
  return http
    .delete(`schedules/${id}`)
    .json<{ ok: true; reload_warning?: string }>();
}
