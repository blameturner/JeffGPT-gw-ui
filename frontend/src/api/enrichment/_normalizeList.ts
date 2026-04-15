export interface NormalizedList<T> {
  items: T[];
  total: number;
}

/**
 * Accept either `{ items, total }` or `{ status, rows }` list shapes and return
 * a normalized `{ items, total }`. Logs once per shape-drift event so we notice
 * the backend changed without breaking the UI.
 */
export function normalizeList<T>(raw: unknown, context: string): NormalizedList<T> {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.items)) {
      return { items: r.items as T[], total: typeof r.total === 'number' ? r.total : r.items.length };
    }
    if (Array.isArray(r.rows)) {
      // Shape drift — fallback to rows. Warn but don't throw.
      if (typeof window !== 'undefined' && !(window as any).__shapeDriftWarned?.[context]) {
        // eslint-disable-next-line no-console
        console.warn(`[api] ${context}: backend returned {rows} shape; normalizing to {items}.`);
        (window as any).__shapeDriftWarned = { ...((window as any).__shapeDriftWarned ?? {}), [context]: true };
      }
      return { items: r.rows as T[], total: typeof r.total === 'number' ? r.total : r.rows.length };
    }
  }
  return { items: [], total: 0 };
}
