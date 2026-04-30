import { useEffect, useMemo, useState } from 'react';
import { harvestApi, isTerminal, type HarvestRun } from '../../api/harvest';
import { Btn, Empty, StatusPill } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

const POLICY_STARTERS = ['topic_seeder', 'feed_watcher', 'domain_crawler'];

const STATUS_OPTIONS = [
  'queued',
  'planning',
  'fetching',
  'extracting',
  'persisting',
  'completed',
  'failed',
  'cancelled',
];

export function RunsTable({
  onSelect,
  activeRunId,
}: {
  onSelect: (r: HarvestRun) => void;
  activeRunId: number | null;
}) {
  const [runs, setRuns] = useState<HarvestRun[] | null>(null);
  const [policyFilter, setPolicyFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [inFlightOnly, setInFlightOnly] = useState(false);

  const load = () =>
    harvestApi
      .listRuns({ limit: 200 })
      .then((r) => setRuns(r.runs))
      .catch(() => setRuns([]));

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (runs?.some((r) => !isTerminal(r.status))) void load();
    }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs?.length, runs?.[0]?.UpdatedAt]);

  const filtered = useMemo(() => {
    if (!runs) return null;
    return runs.filter((r) => {
      if (policyFilter.length && !policyFilter.includes(r.policy)) return false;
      if (statusFilter.length && !statusFilter.includes(r.status)) return false;
      if (inFlightOnly && isTerminal(r.status)) return false;
      return true;
    });
  }, [runs, policyFilter, statusFilter, inFlightOnly]);

  const policyOptions = useMemo(() => {
    if (!runs) return [];
    return Array.from(new Set(runs.map((r) => r.policy))).sort();
  }, [runs]);

  return (
    <div className="px-5 sm:px-7 py-5 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <MultiSelect
          label="policy"
          options={policyOptions}
          value={policyFilter}
          onChange={setPolicyFilter}
        />
        <MultiSelect
          label="status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <label className="flex items-center gap-1.5 text-xs select-none ml-1">
          <input
            type="checkbox"
            checked={inFlightOnly}
            onChange={(e) => setInFlightOnly(e.target.checked)}
            className="accent-fg"
          />
          <span className="uppercase tracking-[0.16em] text-[10px] text-muted">in-flight only</span>
        </label>
        <Btn variant="ghost" size="sm" onClick={load} className="ml-auto">
          Refresh
        </Btn>
      </div>

      {filtered == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : runs && runs.length === 0 ? (
        <Empty
          title="No runs yet"
          hint="Use the Trigger tab to launch a policy."
        >
          {POLICY_STARTERS.map((p) => (
            <span
              key={p}
              className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] border border-border rounded-sm bg-panel"
            >
              {p}
            </span>
          ))}
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty title="no matches" hint="Try clearing a filter or two." />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted border-b border-border">
                <th className="text-left py-2 w-28">status</th>
                <th className="text-left py-2 w-44">policy</th>
                <th className="text-left py-2">seed</th>
                <th className="text-right py-2 w-24">persisted</th>
                <th className="text-right py-2 w-24">unchanged</th>
                <th className="text-right py-2 w-16">failed</th>
                <th className="text-right py-2 w-24">started</th>
                <th className="text-right py-2 w-20">elapsed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const active = activeRunId === r.Id;
                return (
                  <tr
                    key={r.Id}
                    onClick={() => onSelect(r)}
                    className={[
                      'border-b border-border cursor-pointer transition-colors',
                      active ? 'bg-panelHi' : 'hover:bg-panel',
                    ].join(' ')}
                  >
                    <td className="py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="py-2 font-mono text-[11px]">{r.policy}</td>
                    <td
                      className="py-2 text-xs text-fg/85 truncate max-w-0"
                      title={r.seed}
                    >
                      <span className="block truncate" style={{ maxWidth: '60ch' }}>
                        {r.seed}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-xs">
                      <span className="text-fg">{r.urls_persisted}</span>
                      <span className="text-muted">/{r.urls_planned || '?'}</span>
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-muted">
                      {r.urls_unchanged}
                    </td>
                    <td
                      className={`py-2 text-right font-mono text-xs ${
                        r.urls_failed ? 'text-red-700' : 'text-muted'
                      }`}
                    >
                      {r.urls_failed}
                    </td>
                    <td className="py-2 text-right text-xs text-muted">
                      {r.started_at ? relTime(r.started_at) : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-muted">
                      {fmtElapsed(r)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtElapsed(r: HarvestRun): string {
  if (!r.started_at) return '—';
  const end = r.finished_at ? new Date(r.finished_at).getTime() : Date.now();
  const ms = end - new Date(r.started_at).getTime();
  if (ms < 0) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value.length > 0;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'px-2.5 py-1 border rounded-sm text-[10px] uppercase tracking-[0.16em] transition-colors',
          active
            ? 'border-fg bg-fg text-bg'
            : 'border-border text-fg hover:border-fg hover:bg-panelHi',
        ].join(' ')}
      >
        {label}
        {active && <span className="ml-1.5 font-mono">·{value.length}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 top-full mt-1 z-20 bg-bg border border-border rounded-sm shadow-card min-w-[14rem] max-h-72 overflow-y-auto">
            {options.length === 0 ? (
              <li className="px-2.5 py-1.5 text-xs text-muted">no options</li>
            ) : (
              options.map((o) => {
                const on = value.includes(o);
                return (
                  <li key={o}>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(on ? value.filter((x) => x !== o) : [...value, o])
                      }
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-panelHi flex items-center gap-2"
                    >
                      <span
                        className={[
                          'w-3 h-3 border rounded-[2px] flex items-center justify-center text-[9px] leading-none',
                          on ? 'border-fg bg-fg text-bg' : 'border-border',
                        ].join(' ')}
                        aria-hidden
                      >
                        {on ? '✓' : ''}
                      </span>
                      {o}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}
    </div>
  );
}
