import { http } from '../../lib/http';
import type { Worker } from '../types/Worker';

export function listWorkers() {
  return http.get('workers').json<{ workers: Worker[] }>();
}
