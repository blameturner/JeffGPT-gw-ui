// frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx
import { useMemo, useState } from 'react';
import { getDiscoveryRow } from '../../../../../api/enrichment/getDiscoveryRow';
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import { extractApiFailure, fmt, rowIdFromAny, valueAt } from '../lib/formatters';
import { RowDrawer } from './RowDrawer';
import { StatusChip } from './StatusChip';
import { RelativeTime } from './RelativeTime';

type Filter = 'all' | 'new' | 'failed' | 'recent';

export interface DiscoveryPanelProps {
  discovery?: OpsDashboardResponse['discovery'];
  loading?: boolean;
}

export function DiscoveryPanel({ discovery, loading }: DiscoveryPanelProps) {
  const rows = (discovery?.rows ?? []) as Array<Record<string, unknown>>;
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => filterRows(rows, filter), [rows, filter]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<unknown>(null);

  async function openDrawer(id: string) {
    setDrawerId(id);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerData(null);
    try {
      const row = await getDiscoveryRow(id);
      setDrawerData(row);
    } catch (err) {
      setDrawerError(extractApiFailure(err).message);
    } finally {
      setDrawerLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All' },
          { id: 'new', label: 'New' },
          { id: 'failed', label: 'Failed' },
          { id: 'recent', label: 'Recently updated' },
        ]}
      />

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Id</th>
              <th className="px-3 py-2 text-left">URL</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Depth</th>
              <th className="px-3 py-2 text-left">Source URL</th>
              <th className="px-3 py-2 text-left">Updated</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r, idx) => {
              const id = rowIdFromAny(r);
              return (
                <tr key={id ?? `disc-${idx}`} className="hover:bg-panel/30">
                  <td className="px-3 py-2">{fmt(id)}</td>
                  <td className="px-3 py-2 max-w-[24rem] truncate">{fmt(valueAt(r, 'url'))}</td>
                  <td className="px-3 py-2"><StatusChip status={String(valueAt(r, 'status') ?? '')} /></td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'score'))}</td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'depth'))}</td>
                  <td className="px-3 py-2 max-w-[18rem] truncate">{fmt(valueAt(r, 'source_url'))}</td>
                  <td className="px-3 py-2"><RelativeTime iso={(valueAt(r, 'UpdatedAt') ?? valueAt(r, 'CreatedAt')) as string | null | undefined} /></td>
                  <td className="px-3 py-2 max-w-[14rem] truncate">{fmt(valueAt(r, 'error_message'))}</td>
                  <td className="px-3 py-2">
                    {id ? (
                      <button
                        type="button"
                        onClick={() => void openDrawer(id)}
                        className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                      >
                        Open
                      </button>
                    ) : (
                      <span className="text-muted text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted text-xs">
                  No discovery rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RowDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kind="discovery"
        id={drawerId}
        loading={drawerLoading}
        error={drawerError}
        data={drawerData}
      />
    </div>
  );
}

function filterRows(rows: Array<Record<string, unknown>>, filter: Filter) {
  if (filter === 'all') return rows;
  const now = Date.now();
  if (filter === 'recent') {
    return rows.filter((r) => {
      const t = Date.parse(String(valueAt(r, 'UpdatedAt') ?? valueAt(r, 'CreatedAt') ?? ''));
      return !Number.isNaN(t) && now - t < 24 * 3600 * 1000;
    });
  }
  if (filter === 'new') {
    return rows.filter((r) => valueAt(r, 'status') === 'discovered');
  }
  if (filter === 'failed') {
    return rows.filter((r) => valueAt(r, 'status') === 'failed');
  }
  return rows;
}

interface FilterOpt<T extends string> {
  id: T;
  label: string;
}

function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<FilterOpt<T>>;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            'px-2 py-1 rounded border text-[10px] uppercase tracking-[0.14em]',
            value === o.id
              ? 'border-fg text-fg'
              : 'border-border text-muted hover:text-fg',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
