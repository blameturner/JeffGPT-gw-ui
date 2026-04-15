import { http } from '../../lib/http';

export function setupStatus() {
  return http.get('setup/status').json<{ configured: boolean }>();
}
