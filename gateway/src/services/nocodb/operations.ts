import { dataUrl, request } from './client.js';
import { withSoftDelete } from './soft-delete.js';
import type { NocoListResponse } from '../../types/nocodb.js';

export async function listWhere<T>(
  tableName: string,
  where?: string,
  limit = 100,
): Promise<T[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  const body = await request<NocoListResponse<T>>(
    'GET',
    `${dataUrl(tableName)}?${params.toString()}`,
    undefined,
    tableName,
  );
  return body.list;
}

/**
 * Extended list with pagination + sorting. The enrichment log and suggestions
 * tables need `offset` and `sort` (not exposed by `listWhere`), so this helper
 * returns the full `NocoListResponse` (list + pageInfo) for the UI to paginate.
 *
 * `sort` uses Nocodb's comma-separated field list; prefix a field with `-` for
 * descending (e.g. `-times_suggested,-confidence_score`).
 */
export async function listPage<T>(
  tableName: string,
  options: { where?: string; limit?: number; offset?: number; sort?: string } = {},
): Promise<NocoListResponse<T>> {
  const { where, limit = 50, offset = 0, sort } = options;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  if (sort) params.set('sort', sort);
  return request<NocoListResponse<T>>(
    'GET',
    `${dataUrl(tableName)}?${params.toString()}`,
    undefined,
    tableName,
  );
}

/**
 * Count rows matching an optional where clause. Applies soft-delete filter automatically.
 */
export async function countActive(tableName: string, where?: string): Promise<number> {
  const params = new URLSearchParams({ limit: '1' });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  const body = await request<NocoListResponse<unknown>>(
    'GET',
    `${dataUrl(tableName)}?${params.toString()}`,
    undefined,
    tableName,
  );
  return body.pageInfo?.totalRows ?? 0;
}

export function createRow<T>(tableName: string, data: Record<string, unknown>): Promise<T> {
  return request<T>('POST', dataUrl(tableName), data, tableName);
}

export function deleteRow(tableName: string, rowId: string | number): Promise<unknown> {
  return request<unknown>('DELETE', dataUrl(tableName, rowId), undefined, tableName);
}

export function patchRow<T>(
  tableName: string,
  rowId: string | number,
  data: Record<string, unknown>,
): Promise<T> {
  return request<T>('PATCH', dataUrl(tableName, rowId), data, tableName);
}
