import { http } from '../../lib/http';
import type { DockerContainer } from '../types/DockerContainer';

export function listLogContainers() {
  return http.get('logs/containers').json<{ containers: DockerContainer[] }>();
}
