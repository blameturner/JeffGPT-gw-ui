import { http } from '../../lib/http';
import type { AgentSchedule } from '../types/AgentSchedule';

export function listSchedules() {
  return http.get('schedules').json<{ schedules: AgentSchedule[] }>();
}
