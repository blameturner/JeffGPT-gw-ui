import { http } from '../../lib/http';

export function listWorkerTypes() {
  return http
    .get('workers/types')
    .json<{ types: { id: string; name: string; description: string }[] }>();
}
