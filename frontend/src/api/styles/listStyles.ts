import { http } from '../../lib/http';
import type { StylesResponse } from '../types/StylesResponse';

export function listStyles(surface?: 'chat' | 'code') {
  return http
    .get('styles', { searchParams: surface ? { surface } : {} })
    .json<StylesResponse>();
}
