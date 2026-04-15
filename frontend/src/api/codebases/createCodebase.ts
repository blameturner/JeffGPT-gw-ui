import { http } from '../../lib/http';
import type { Codebase } from '../types/Codebase';

export function createCodebase(body: { name: string; description?: string }) {
  return http.post('codebases', { json: body }).json<Codebase>();
}
