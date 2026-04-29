import { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from '../../connectors/components/Drawer';
import { Field, SelectInput } from '../../connectors/components/Field';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';
import { DangerZone } from '../../connectors/components/DangerZone';
import {
  cancelAssignment,
  getAgentRun,
  listAgentArtifactVersions,
  listAgentAssignments,
  listAgentRuns,
  retryAssignment,
  rollbackArtifactVersion,
  runAgentNow,
} from '../api';
import type {
  Agent,
  AgentRunDetail,
  AgentRunSummary,
  ArtifactVersion,
  Assignment,
} from '../types';
import { EventTimeline } from '../components/EventTimeline';
import { DiffViewer } from '../components/DiffViewer';

type SubView = 'assignments' | 'runs' | 'versions';

const PAGE = 50;

// ---- Format helpers ---------------------------------------------------------

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function fmtDuration(ms?: number | null, startedAt?: string | null, completedAt?: string | null): string {
  let v = ms ?? null;
  if (v == null && startedAt && completedAt) {
    const a = new Date(startedAt).getTime();
    const b = new Date(completedAt).getTime();
    if (!Number.isNaN(a) && !Number.isNaN(b)) v = b - a;
  }
  if (v == null) return '—';
  if (v < 1000) return `${v} ms`;
  const s = v / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return `${m}m ${rest}s`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'ok' || status === 'done'
      ? 'text-emerald-800 border-emerald-300 bg-emerald-50'
      : status === 'error' || status === 'failed'
        ? 'text-red-800 border-red-300 bg-red-50'
        : status === 'running' || status === 'claimed'
          ? 'text-blue-800 border-blue-300 bg-blue-50'
          : status === 'queued'
            ? 'text-amber-800 border-amber-300 bg-amber-50'
            : status === 'aborted' || status === 'cancelled'
              ? 'text-muted border-border bg-panel'
              : 'text-muted border-border bg-panel';
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-[0.14em] font-mono border px-1.5 py-[1px] ${tone}`}
    >
      {status}
    </span>
  );
}

function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-block text-[10px] uppercase tracking-[0.14em] font-mono border border-border px-1.5 py-[1px] text-muted">
      {source}
    </span>
  );
}

// ---- Sub-tab strip ---------------------------------------------------------

function SubTabStrip({
  view,
  onChange,
}: {
  view: SubView;
  onChange: (v: SubView) => void;
}) {
  const items: Array<{ id: SubView; label: string }> = [
    { id: 'assignments', label: 'Assignments' },
    { id: 'runs', label: 'Runs' },
    { id: 'versions', label: 'Versions' },
  ];
  return (
    <div className="flex items-center gap-0 border-b border-border">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={`px-3 py-2 text-[11px] uppercase tracking-[0.18em] font-sans transition-colors ${
            view === it.id ? 'text-fg border-b border-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ---- Result-ref rendering ---------------------------------------------------

function isRowRef(v: unknown): v is { table: string; row_id: number | string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).table === 'string' &&
    'row_id' in (v as Record<string, unknown>)
  );
}

function ResultRefValue({ value }: { value: unknown }) {
  if (isRowRef(value)) {
    return (
      <span className="inline-block text-[10px] uppercase tracking-[0.14em] font-mono border border-border px-1.5 py-[1px] text-muted">
        {value.table}#{String(value.row_id)}
      </span>
    );
  }
  return (
    <pre className="text-[11px] font-mono bg-panel border border-border p-2 whitespace-pre-wrap overflow-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ---- Assignments view ------------------------------------------------------

function AssignmentsView({
  agent,
  onOpenRun,
}: {
  agent: Agent;
  onOpenRun: (runId: number) => void;
}) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const r = await listAgentAssignments(agent.Id, {
          status: status || undefined,
          cursor: reset ? undefined : cursor ?? undefined,
          limit: PAGE,
        });
        let list = r.assignments;
        if (source) list = list.filter((a) => a.source === source);
        setItems((prev) => (reset ? list : [...prev, ...list]));
        setCursor(r.next_cursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load assignments.');
      } finally {
        setLoading(false);
      }
    },
    [agent.Id, cursor, status, source],
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.Id, status, source]);

  async function doCancel(id: number) {
    setActionBusy(true);
    try {
      await cancelAssignment(id);
      await load(true);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel.');
    } finally {
      setActionBusy(false);
    }
  }

  async function doRetry(id: number) {
    setActionBusy(true);
    try {
      await retryAssignment(id);
      await load(true);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retry.');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Field label="Status">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="queued">queued</option>
              <option value="claimed">claimed</option>
              <option value="running">running</option>
              <option value="awaiting_approval">awaiting_approval</option>
              <option value="done">done</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </SelectInput>
          </Field>
        </div>
        <div className="w-44">
          <Field label="Source">
            <SelectInput value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All</option>
              <option value="manual">manual</option>
              <option value="cron">cron</option>
              <option value="email">email</option>
              <option value="webhook">webhook</option>
              <option value="api">api</option>
              <option value="completion">completion</option>
              <option value="table_watch">table_watch</option>
              <option value="supervisor">supervisor</option>
            </SelectInput>
          </Field>
        </div>
        <div className="ml-auto">
          <SecondaryButton onClick={() => void load(true)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </SecondaryButton>
        </div>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-xs font-sans">
          <thead className="bg-panel">
            <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
              <th className="text-left px-2 py-2 font-sans">id</th>
              <th className="text-left px-2 py-2 font-sans">source</th>
              <th className="text-left px-2 py-2 font-sans">task</th>
              <th className="text-left px-2 py-2 font-sans">status</th>
              <th className="text-left px-2 py-2 font-sans">prio</th>
              <th className="text-left px-2 py-2 font-sans">attempts</th>
              <th className="text-left px-2 py-2 font-sans">created</th>
              <th className="text-left px-2 py-2 font-sans">completed</th>
              <th className="text-left px-2 py-2 font-sans">duration</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr
                key={a.Id}
                onClick={() => setSelected(a)}
                className="border-t border-border hover:bg-panelHi cursor-pointer"
              >
                <td className="px-2 py-1.5 font-mono text-muted">#{a.Id}</td>
                <td className="px-2 py-1.5">
                  <SourceChip source={a.source} />
                </td>
                <td className="px-2 py-1.5 font-mono text-[11px]">{truncate(a.task ?? '', 80)}</td>
                <td className="px-2 py-1.5">
                  <StatusChip status={a.status} />
                </td>
                <td className="px-2 py-1.5 font-mono">{a.priority ?? '—'}</td>
                <td className="px-2 py-1.5 font-mono">{a.attempts ?? '—'}</td>
                <td className="px-2 py-1.5 font-mono text-muted">{fmtTime(a.created_at)}</td>
                <td className="px-2 py-1.5 font-mono text-muted">{fmtTime(a.completed_at)}</td>
                <td className="px-2 py-1.5 font-mono">
                  {fmtDuration(a.duration_ms, a.claimed_at, a.completed_at)}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-2 py-6 text-center text-xs text-muted">
                  No assignments.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void load(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </GhostButton>
        </div>
      )}

      {selected && (
        <Drawer open onClose={() => setSelected(null)} label={`Assignment #${selected.Id}`}>
          <DrawerHeader
            title={`Assignment #${selected.Id}`}
            subtitle={`${selected.source} · ${selected.status}`}
            onClose={() => setSelected(null)}
          />
          <DrawerBody>
            <section>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">Task</div>
              <pre className="text-xs font-mono whitespace-pre-wrap border border-border bg-panel p-3">
                {selected.task}
              </pre>
            </section>

            {selected.error && (
              <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs whitespace-pre-wrap">
                {selected.error}
              </div>
            )}

            <section>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">
                source_meta_json
              </div>
              <pre className="text-[11px] font-mono whitespace-pre-wrap border border-border bg-panel p-3 max-h-64 overflow-auto">
                {selected.source_meta_json
                  ? JSON.stringify(selected.source_meta_json, null, 2)
                  : '—'}
              </pre>
            </section>

            <section>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">
                result_summary
              </div>
              <div className="text-xs whitespace-pre-wrap font-mono border border-border bg-panel p-3">
                {selected.result_summary ?? '—'}
              </div>
            </section>

            <section>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">
                result_ref_json
              </div>
              {selected.result_ref_json && Object.keys(selected.result_ref_json).length > 0 ? (
                <ul className="space-y-2">
                  {Object.entries(selected.result_ref_json).map(([k, v]) => (
                    <li key={k}>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-0.5 font-mono">
                        {k}
                      </div>
                      <ResultRefValue value={v} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted">—</div>
              )}
            </section>

            <div className="text-[11px] font-mono text-muted">
              attempts: {selected.attempts ?? 0} · dedup: {selected.dedup_key ?? '—'}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <div className="flex items-center gap-2">
              {(selected.status === 'queued' || selected.status === 'claimed') && (
                <SecondaryButton
                  disabled={actionBusy}
                  onClick={() => void doCancel(selected.Id)}
                >
                  {actionBusy ? 'Working…' : 'Cancel'}
                </SecondaryButton>
              )}
              {selected.status === 'failed' && (
                <SecondaryButton
                  disabled={actionBusy}
                  onClick={() => void doRetry(selected.Id)}
                >
                  {actionBusy ? 'Working…' : 'Retry'}
                </SecondaryButton>
              )}
              {(() => {
                const refRunId =
                  selected.result_ref_json && typeof selected.result_ref_json.run_id === 'number'
                    ? (selected.result_ref_json.run_id as number)
                    : null;
                if (refRunId == null) return null;
                return (
                  <PrimaryButton
                    onClick={() => {
                      onOpenRun(refRunId);
                      setSelected(null);
                    }}
                  >
                    Open run record
                  </PrimaryButton>
                );
              })()}
            </div>
            <span />
          </DrawerFooter>
        </Drawer>
      )}
    </div>
  );
}

// ---- Runs view -------------------------------------------------------------

function RunsView({
  agent,
  pendingOpenRunId,
  onConsumed,
}: {
  agent: Agent;
  pendingOpenRunId: number | null;
  onConsumed: () => void;
}) {
  const [items, setItems] = useState<AgentRunSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [rerunBusy, setRerunBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const r = await listAgentRuns(agent.Id, {
          cursor: reset ? undefined : cursor ?? undefined,
          limit: PAGE,
        });
        setItems((prev) => (reset ? r.runs : [...prev, ...r.runs]));
        setCursor(r.next_cursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load runs.');
      } finally {
        setLoading(false);
      }
    },
    [agent.Id, cursor],
  );

  const openRunDetail = useCallback(
    async (runId: number) => {
      setLoadingDetail(true);
      try {
        const detail = await getAgentRun(agent.Id, runId);
        setSelected(detail);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load run.');
      } finally {
        setLoadingDetail(false);
      }
    },
    [agent.Id],
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.Id]);

  useEffect(() => {
    if (pendingOpenRunId != null) {
      void openRunDetail(pendingOpenRunId);
      onConsumed();
    }
  }, [pendingOpenRunId, openRunDetail, onConsumed]);

  // Best-effort: try to extract original task from prompt_snapshot.
  const reconstructedTask = useMemo<string | null>(() => {
    if (!selected?.prompt_snapshot) return null;
    const m = selected.prompt_snapshot.match(/(?:^|\n)(?:Task|TASK):\s*([\s\S]+?)(?:\n\n|\n[A-Z][A-Z _-]{2,}:|$)/);
    return m ? m[1].trim() : null;
  }, [selected]);

  async function rerun() {
    if (!selected || !reconstructedTask) return;
    setRerunBusy(true);
    try {
      await runAgentNow(agent.Id, { task: reconstructedTask });
      await load(true);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to re-run.');
    } finally {
      setRerunBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <SecondaryButton onClick={() => void load(true)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </SecondaryButton>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-xs font-sans">
          <thead className="bg-panel">
            <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
              <th className="text-left px-2 py-2 font-sans">id</th>
              <th className="text-left px-2 py-2 font-sans">status</th>
              <th className="text-left px-2 py-2 font-sans">started</th>
              <th className="text-left px-2 py-2 font-sans">duration</th>
              <th className="text-left px-2 py-2 font-sans">iter</th>
              <th className="text-left px-2 py-2 font-sans">in / out</th>
              <th className="text-left px-2 py-2 font-sans">cost (USD)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.Id}
                onClick={() => void openRunDetail(r.Id)}
                className="border-t border-border hover:bg-panelHi cursor-pointer"
              >
                <td className="px-2 py-1.5 font-mono text-muted">#{r.Id}</td>
                <td className="px-2 py-1.5">
                  <StatusChip status={r.status} />
                </td>
                <td className="px-2 py-1.5 font-mono text-muted">{fmtTime(r.started_at)}</td>
                <td className="px-2 py-1.5 font-mono">
                  {fmtDuration(r.duration_ms, r.started_at, r.finished_at)}
                </td>
                <td className="px-2 py-1.5 font-mono">{r.iterations ?? '—'}</td>
                <td className="px-2 py-1.5 font-mono">
                  {(r.tokens_in ?? '—')} / {(r.tokens_out ?? '—')}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {r.cost_usd != null ? r.cost_usd.toFixed(4) : '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-xs text-muted">
                  No runs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void load(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </GhostButton>
        </div>
      )}

      {(selected || loadingDetail) && (
        <Drawer
          open
          onClose={() => setSelected(null)}
          label={selected ? `Run #${selected.Id}` : 'Run'}
        >
          <DrawerHeader
            title={selected ? `Run #${selected.Id}` : 'Loading…'}
            subtitle={selected ? `${selected.status}` : undefined}
            onClose={() => setSelected(null)}
          />
          <DrawerBody>
            {!selected ? (
              <div className="text-xs text-muted">Loading run…</div>
            ) : (
              <>
                {selected.error && (
                  <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs whitespace-pre-wrap">
                    {selected.error}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-muted">
                  <div>started: {fmtTime(selected.started_at)}</div>
                  <div>
                    duration:{' '}
                    {fmtDuration(selected.duration_ms, selected.started_at, selected.finished_at)}
                  </div>
                  <div>iter: {selected.iterations ?? '—'}</div>
                  <div>cost: {selected.cost_usd != null ? selected.cost_usd.toFixed(4) : '—'}</div>
                  <div>tokens_in: {selected.tokens_in ?? '—'}</div>
                  <div>tokens_out: {selected.tokens_out ?? '—'}</div>
                  <div>assignment: {selected.assignment_id ?? '—'}</div>
                  <div>finished: {fmtTime(selected.finished_at)}</div>
                </div>

                <section className="border border-border">
                  <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-panel">
                    <span className="text-[11px] uppercase tracking-[0.14em] font-sans">
                      prompt_snapshot
                    </span>
                    {selected.prompt_snapshot && (
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(selected.prompt_snapshot ?? '');
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1200);
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </header>
                  <pre className="text-[11px] font-mono p-3 max-h-72 overflow-auto whitespace-pre-wrap">
                    {selected.prompt_snapshot ?? '—'}
                  </pre>
                </section>

                <section>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                    Events
                  </div>
                  <EventTimeline events={selected.events_jsonl ?? []} />
                </section>
              </>
            )}
          </DrawerBody>
          <DrawerFooter>
            <span />
            <div className="flex items-center gap-2">
              <SecondaryButton
                disabled={!reconstructedTask || rerunBusy}
                title={
                  reconstructedTask
                    ? 'Re-run with the same task'
                    : 'Original task not available on this run record'
                }
                onClick={() => void rerun()}
              >
                {rerunBusy ? 'Queuing…' : 'Re-run with same task'}
              </SecondaryButton>
            </div>
          </DrawerFooter>
        </Drawer>
      )}
    </div>
  );
}

// ---- Versions view ---------------------------------------------------------

function fmtBytesDelta(before?: number | null, after?: number | null): string {
  const b = before ?? 0;
  const a = after ?? 0;
  const added = Math.max(0, a - b);
  const removed = Math.max(0, b - a);
  return `+${added}, -${removed} bytes`;
}

function VersionsView({ agent }: { agent: Agent }) {
  const [items, setItems] = useState<ArtifactVersion[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArtifactVersion | null>(null);
  const [rolling, setRolling] = useState(false);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const r = await listAgentArtifactVersions(agent.Id, {
          cursor: reset ? undefined : cursor ?? undefined,
          limit: PAGE,
        });
        setItems((prev) => (reset ? r.versions : [...prev, ...r.versions]));
        setCursor(r.next_cursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load versions.');
      } finally {
        setLoading(false);
      }
    },
    [agent.Id, cursor],
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.Id]);

  async function doRollback() {
    if (!selected) return;
    setRolling(true);
    try {
      await rollbackArtifactVersion(selected.Id);
      await load(true);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed.');
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <SecondaryButton onClick={() => void load(true)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </SecondaryButton>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-xs font-sans">
          <thead className="bg-panel">
            <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
              <th className="text-left px-2 py-2 font-sans">timestamp</th>
              <th className="text-left px-2 py-2 font-sans">path</th>
              <th className="text-left px-2 py-2 font-sans">delta</th>
              <th className="text-left px-2 py-2 font-sans">written by</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr
                key={v.Id}
                onClick={() => setSelected(v)}
                className="border-t border-border hover:bg-panelHi cursor-pointer"
              >
                <td className="px-2 py-1.5 font-mono text-muted">{fmtTime(v.created_at)}</td>
                <td className="px-2 py-1.5 font-mono">
                  {v.table}.{String(v.row_id)}.{v.column}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {fmtBytesDelta(v.before_bytes, v.after_bytes)}
                </td>
                <td className="px-2 py-1.5 font-mono text-muted">
                  {v.assignment_id != null ? `assignment #${v.assignment_id}` : '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-2 py-6 text-center text-xs text-muted">
                  No versions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void load(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </GhostButton>
        </div>
      )}

      {selected && (
        <Drawer
          open
          onClose={() => setSelected(null)}
          label={`Version #${selected.Id}`}
        >
          <DrawerHeader
            title={`Version #${selected.Id}`}
            subtitle={`${selected.table}.${String(selected.row_id)}.${selected.column}`}
            onClose={() => setSelected(null)}
          />
          <DrawerBody>
            <DiffViewer before={selected.before_text} after={selected.after_text} />
            <div className="text-[11px] font-mono text-muted">
              {fmtBytesDelta(selected.before_bytes, selected.after_bytes)} ·{' '}
              {fmtTime(selected.created_at)} ·{' '}
              {selected.assignment_id != null ? `assignment #${selected.assignment_id}` : 'manual'}
            </div>
            <DangerZone
              resourceLabel="version"
              confirmName={selected.column}
              busy={rolling}
              onDelete={() => doRollback()}
            >
              Rollback this column to the previous value. Type the column name to confirm.
            </DangerZone>
          </DrawerBody>
          <DrawerFooter>
            <span />
            <GhostButton onClick={() => setSelected(null)}>Close</GhostButton>
          </DrawerFooter>
        </Drawer>
      )}
    </div>
  );
}

// ---- Top-level tab ---------------------------------------------------------

export function ActivityTab({ agent }: { agent: Agent }) {
  const [view, setView] = useState<SubView>('assignments');
  const [pendingOpenRunId, setPendingOpenRunId] = useState<number | null>(null);

  const openRunFromAssignment = useCallback((runId: number) => {
    setPendingOpenRunId(runId);
    setView('runs');
  }, []);

  return (
    <div className="p-6 space-y-4">
      <SubTabStrip view={view} onChange={setView} />
      {view === 'assignments' && (
        <AssignmentsView agent={agent} onOpenRun={openRunFromAssignment} />
      )}
      {view === 'runs' && (
        <RunsView
          agent={agent}
          pendingOpenRunId={pendingOpenRunId}
          onConsumed={() => setPendingOpenRunId(null)}
        />
      )}
      {view === 'versions' && <VersionsView agent={agent} />}
    </div>
  );
}
