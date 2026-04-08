import { env } from './env.js';

type TableMap = Record<string, string>;
let tableIds: TableMap = {};

const headers = () => ({
  'xc-token': env.NOCODB_TOKEN,
  'Content-Type': 'application/json',
});

export async function initNocodbTables(): Promise<TableMap> {
  const url = `${env.NOCODB_URL}/api/v1/db/meta/projects/${env.NOCODB_BASE_ID}/tables`;
  const maxAttempts = 15; // 15 × 2s = 30s
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) {
        throw new Error(`Nocodb table discovery HTTP ${res.status}: ${await res.text()}`);
      }
      const body = (await res.json()) as { list: Array<{ title: string; id: string }> };
      tableIds = Object.fromEntries(body.list.map((t) => [t.title, t.id]));
      console.log('[nocodb] discovered tables:', Object.keys(tableIds).join(', '));
      return tableIds;
    } catch (err) {
      lastErr = err;
      console.log(`[nocodb] not ready, retrying… (${attempt}/${maxAttempts})`);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(
    `Could not connect to Nocodb after ${maxAttempts * 2} seconds: ${String(lastErr)}`,
  );
}

function tableId(name: string): string {
  const id = tableIds[name];
  if (!id) throw new Error(`Nocodb table not found: ${name}`);
  return id;
}

function dataUrl(tableName: string, rowId?: string | number) {
  const base = `${env.NOCODB_URL}/api/v1/db/data/noco/${env.NOCODB_BASE_ID}/${tableId(tableName)}`;
  return rowId != null ? `${base}/${rowId}` : base;
}

// Tables that have a deleted_at column. Queries on these must filter ~and(deleted_at,is,null).
const SOFT_DELETE_TABLES = new Set([
  'organisations',
  'users',
  'agents',
  'workers',
  'agent_schedules',
  'agent_memory',
  'observations',
  'tasks',
  'conversations',
  'knowledge_sources',
  'scrape_targets',
  'training_examples',
  'notifications',
  'project_members',
]);

function withSoftDelete(tableName: string, where?: string): string | undefined {
  if (!SOFT_DELETE_TABLES.has(tableName)) return where || undefined;
  const softFilter = '(deleted_at,is,null)';
  if (!where) return softFilter;
  return `${where}~and${softFilter}`;
}

export async function listWhere<T = any>(
  tableName: string,
  where?: string,
  limit = 100,
): Promise<T[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  const res = await fetch(`${dataUrl(tableName)}?${params.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(`Nocodb list ${tableName} failed: ${res.status}`);
  const body = (await res.json()) as { list: T[] };
  return body.list;
}

/**
 * Count rows matching an optional where clause. Applies soft-delete filter automatically.
 */
export async function countActive(tableName: string, where?: string): Promise<number> {
  const params = new URLSearchParams({ limit: '1' });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  const res = await fetch(`${dataUrl(tableName)}?${params.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(`Nocodb count ${tableName} failed: ${res.status}`);
  const body = (await res.json()) as { pageInfo?: { totalRows?: number } };
  return body.pageInfo?.totalRows ?? 0;
}

export async function createRow<T = any>(tableName: string, data: Record<string, any>): Promise<T> {
  const res = await fetch(dataUrl(tableName), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Nocodb create ${tableName} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function patchRow<T = any>(
  tableName: string,
  rowId: string | number,
  data: Record<string, any>,
): Promise<T> {
  const res = await fetch(dataUrl(tableName, rowId), {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Nocodb patch ${tableName} failed: ${res.status}`);
  return (await res.json()) as T;
}
