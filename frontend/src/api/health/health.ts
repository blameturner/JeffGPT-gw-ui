import { http } from '../../lib/http';

export function health() {
  return http.get('health').json<{ status: string; harness: string }>();
}
