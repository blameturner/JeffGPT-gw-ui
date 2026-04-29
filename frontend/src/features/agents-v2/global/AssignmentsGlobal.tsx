import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelAssignment,
  listAgentsRich,
  listAssignments,
  patchAssignment,
  retryAssignment,
} from '../api';
import type { Agent, AgentListRow, Assignment } from '../types';
import { Modal } from '../../connectors/components/Modal';
import { Field, SelectInput, TextInput } from '../../connectors/components/Field';
import {
  GhostButton,
  PrimaryButton,
  SecondaryButton,
} from '../../connectors/components/Toolbar';
import { EmptyState } from '../../connectors/components/EmptyState';

const STATUS_OPTIONS = [
  'all',
  'queued',
  'claimed',
  'running',
  'awaiting_approval',
  'done',
  'failed',
  'cancelled',
] as const;
const SOURCE_OPTIONS = [
  'all',
  'cron',
  'manual',
  'email',
  'webhook',
  'api',
  'completion',
  'table_watch',
  'supervisor',
] as const;

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.floor(diff)} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

function fmtDuration(ms?: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}m`;
}

function StatusChip({ status }: { status: Assignment['status'] }) {
  const tone =
    status === 'done'
      ? 'border-emerald-600/40 text-emerald-700'
      : status === 'failed'
        ? 'border-red-600/40 text-red-700'
        : status === 'cancelled'
          ? 'border-border text-muted'
          : status === 'running'
            ? 'border-blue-600/40 text-blue-700'
            : 'border-border text-fg';
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans ${tone}`}
    >
      {status}
    </span>
  );
}

function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-block border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
      {source}
    </span>
  );
}

function AgentMultiSelect({
  agents,
  selected,
  onChange,
}: {
  agents: AgentListRow[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    return agents.filter((a) => !t || a.name.toLowerCase().includes(t));
  }, [agents, q]);
  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }
  return (
    <div className="relative">
      <TextInput
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={selected.length ? `${selected.length} agent(s)` : 'Filter agents'}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-border bg-bg shadow-xl">
          {filtered.map((a) => (
            <button
              key={a.Id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle(a.Id)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-panelHi ${selected.includes(a.Id) ? 'bg-panel' : ''}`}
            >
              <input type="checkbox" readOnly checked={selected.includes(a.Id)} />
              <span className="font-sans">{a.name}</span>
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((id) => {
            const a = agents.find((x) => x.Id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] hover:border-fg"
              >
                {a?.name ?? `#${id}`} ×
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatStrip({ rows }: { rows: Assignment[] }) {
  const queued = rows.filter((r) => r.status === 'queued' || r.status === 'claimed').length;
  const running = rows.filter((r) => r.status === 'running').length;
  const since = Date.now() - 24 * 3600 * 1000;
  const failed24 = rows.filter(
    (r) =>
      r.status === 'failed' && r.created_at && new Date(r.created_at).getTime() >= since,
  ).length;
  const claimed = rows.filter((r) => r.claimed_at && r.created_at);
  const avgClaim =
    claimed.length === 0
      ? null
      : claimed.reduce((acc, r) => {
          const d = (new Date(r.claimed_at!).getTime() - new Date(r.created_at!).getTime()) / 1000;
          return acc + d;
        }, 0) / claimed.length;
  const stats: Array<{ label: string; value: string }> = [
    { label: 'Queued', value: String(queued) },
    { label: 'Running', value: String(running) },
    { label: 'Failed 24h', value: String(failed24) },
    {
      label: 'Avg time-to-claim',
      value: avgClaim == null ? '—' : `${avgClaim.toFixed(1)}s`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="border border-border bg-panel px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
            {s.label}
          </div>
          <div className="font-display text-2xl tracking-tightest">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function AssignmentDetailModal({
  assignment,
  onClose,
  onAction,
}: {
  assignment: Assignment | null;
  onClose: () => void;
  onAction: (kind: 'cancel' | 'retry' | 'priority', a: Assignment) => void;
}) {
  if (!assignment) return null;
  return (
    <Modal
      open={!!assignment}
      onClose={onClose}
      size="lg"
      title={`Assignment #${assignment.Id}`}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => onAction('priority', assignment)}>
            Change priority
          </SecondaryButton>
          <SecondaryButton onClick={() => onAction('cancel', assignment)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => onAction('retry', assignment)}>Retry</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <StatusChip status={assignment.status} />
          <SourceChip source={assignment.source} />
          <span className="text-xs text-muted font-mono">prio {assignment.priority ?? '—'}</span>
          <span className="text-xs text-muted font-mono">attempts {assignment.attempts ?? 0}</span>
        </div>
        <Field label="Task">
          <pre className="whitespace-pre-wrap break-words bg-panel border border-border p-3 font-mono text-xs">
            {assignment.task}
          </pre>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Created">
            <div className="text-sm font-mono">{fmtTime(assignment.created_at)}</div>
          </Field>
          <Field label="Claimed">
            <div className="text-sm font-mono">{fmtTime(assignment.claimed_at)}</div>
          </Field>
          <Field label="Completed">
            <div className="text-sm font-mono">{fmtTime(assignment.completed_at)}</div>
          </Field>
          <Field label="Duration">
            <div className="text-sm font-mono">{fmtDuration(assignment.duration_ms)}</div>
          </Field>
        </div>
        {assignment.source_meta_json && (
          <Field label="Source meta">
            <pre className="bg-panel border border-border p-3 font-mono text-xs overflow-auto">
              {JSON.stringify(assignment.source_meta_json, null, 2)}
            </pre>
          </Field>
        )}
        {assignment.result_summary && (
          <Field label="Result summary">
            <pre className="whitespace-pre-wrap break-words bg-panel border border-border p-3 font-mono text-xs">
              {assignment.result_summary}
            </pre>
          </Field>
        )}
        {assignment.result_ref_json && (
          <Field label="Result ref">
            <pre className="bg-panel border border-border p-3 font-mono text-xs overflow-auto">
              {JSON.stringify(assignment.result_ref_json, null, 2)}
            </pre>
          </Field>
        )}
        {assignment.error && (
          <Field label="Error">
            <pre className="whitespace-pre-wrap break-words bg-panel border border-red-600/40 text-red-700 p-3 font-mono text-xs">
              {assignment.error}
            </pre>
          </Field>
        )}
      </div>
    </Modal>
  );
}

function PriorityModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (priority: number) => void;
  initial: number;
}) {
  const [val, setVal] = useState(initial);
  useEffect(() => {
    if (open) setVal(initial);
  }, [open, initial]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Change priority"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => onSubmit(val)}>Apply</PrimaryButton>
        </div>
      }
    >
      <Field label={`Priority: ${val}`}>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="w-full"
        />
      </Field>
    </Modal>
  );
}

export function AssignmentsGlobal() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [agents, setAgents] = useState<AgentListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [filterAgents, setFilterAgents] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [active, setActive] = useState<Assignment | null>(null);
  const [priorityModal, setPriorityModal] = useState<{ open: boolean; ids: number[]; initial: number }>(
    { open: false, ids: [], initial: 5 },
  );

  // Debounce search.
  const tRef = useRef<number | null>(null);
  useEffect(() => {
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [search]);

  // Load agents for filter.
  useEffect(() => {
    listAgentsRich().then((r) => setAgents(r.agents)).catch(() => setAgents([]));
  }, []);

  async function load(reset = true) {
    setLoading(true);
    setError(null);
    try {
      // TODO: subscribe to assignments channel for live updates
      const res = await listAssignments({
        q: debouncedSearch || undefined,
        agent_id: filterAgents.length === 1 ? filterAgents[0] : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        source: filterSource !== 'all' ? filterSource : undefined,
        start: filterStart || undefined,
        end: filterEnd || undefined,
        cursor: reset ? undefined : cursor ?? undefined,
        limit: 50,
      });
      let list = res.assignments;
      if (filterAgents.length > 1) list = list.filter((a) => filterAgents.includes(a.agent_id));
      setRows(reset ? list : [...rows, ...list]);
      setNextCursor(res.next_cursor ?? null);
    } catch (e) {
      setError((e as Error).message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    setCursor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterStatus, filterSource, filterStart, filterEnd, filterAgents.join(',')]);

  function toggleSelect(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function bulk(kind: 'cancel' | 'retry' | 'priority') {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (kind === 'priority') {
      setPriorityModal({ open: true, ids, initial: 5 });
      return;
    }
    for (const id of ids) {
      try {
        if (kind === 'cancel') await cancelAssignment(id);
        else await retryAssignment(id);
      } catch {
        // ignore individual errors
      }
    }
    setSelected(new Set());
    load(true);
  }

  async function singleAction(kind: 'cancel' | 'retry' | 'priority', a: Assignment) {
    if (kind === 'priority') {
      setPriorityModal({ open: true, ids: [a.Id], initial: a.priority ?? 5 });
      return;
    }
    try {
      if (kind === 'cancel') await cancelAssignment(a.Id);
      else await retryAssignment(a.Id);
      setActive(null);
      load(true);
    } catch (e) {
      setError((e as Error).message || 'Action failed');
    }
  }

  async function applyPriority(p: number) {
    for (const id of priorityModal.ids) {
      try {
        await patchAssignment(id, { priority: p });
      } catch {
        // ignore
      }
    }
    setPriorityModal({ open: false, ids: [], initial: 5 });
    setSelected(new Set());
    setActive(null);
    load(true);
  }

  return (
    <div className="p-6 space-y-4">
      <StatStrip rows={rows} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
        <div className="md:col-span-2">
          <AgentMultiSelect agents={agents} selected={filterAgents} onChange={setFilterAgents} />
        </div>
        <SelectInput value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectInput>
        <TextInput
          type="date"
          value={filterStart}
          onChange={(e) => setFilterStart(e.target.value)}
        />
        <TextInput type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
      </div>
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search task…"
      />

      {selected.size > 0 && (
        <div className="flex items-center gap-2 border border-border bg-panel px-3 py-2">
          <span className="text-xs font-mono text-muted">{selected.size} selected</span>
          <SecondaryButton onClick={() => bulk('cancel')}>Cancel</SecondaryButton>
          <SecondaryButton onClick={() => bulk('retry')}>Retry</SecondaryButton>
          <SecondaryButton onClick={() => bulk('priority')}>Change priority</SecondaryButton>
          <GhostButton onClick={() => setSelected(new Set())}>Clear</GhostButton>
        </div>
      )}

      {error && (
        <div className="border border-red-600/40 bg-panel px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <SecondaryButton onClick={() => load(true)}>Retry</SecondaryButton>
        </div>
      )}

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel border-b border-border">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === rows.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(rows.map((r) => r.Id)) : new Set())
                  }
                />
              </th>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Agent</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Task</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Prio</th>
              <th className="px-2 py-2">Att</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-2 py-2">Completed</th>
              <th className="px-2 py-2">Duration</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border">
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-2 py-3">
                        <div className="h-3 w-full animate-pulse bg-panel" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((r) => (
                  <tr
                    key={r.Id}
                    onClick={() => setActive(r)}
                    className="border-b border-border cursor-pointer hover:bg-panel"
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.Id)}
                        onChange={() => toggleSelect(r.Id)}
                      />
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{r.Id}</td>
                    <td className="px-2 py-2">
                      <a
                        href={`/agents?id=${r.agent_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {r.agent_name ?? `#${r.agent_id}`}
                      </a>
                    </td>
                    <td className="px-2 py-2">
                      <SourceChip source={r.source} />
                    </td>
                    <td className="px-2 py-2 max-w-[280px] truncate font-mono text-xs">{r.task}</td>
                    <td className="px-2 py-2">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{r.priority ?? '—'}</td>
                    <td className="px-2 py-2 font-mono text-xs">{r.attempts ?? 0}</td>
                    <td className="px-2 py-2 font-mono text-xs" title={fmtTime(r.created_at)}>
                      {relTime(r.created_at)}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{fmtTime(r.completed_at)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{fmtDuration(r.duration_ms)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && (
          <EmptyState title="No assignments" body="Filter results are empty. Try widening." />
        )}
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <SecondaryButton
            onClick={() => {
              setCursor(nextCursor);
              load(false);
            }}
            disabled={loading}
          >
            Load more
          </SecondaryButton>
        </div>
      )}

      <AssignmentDetailModal
        assignment={active}
        onClose={() => setActive(null)}
        onAction={singleAction}
      />
      <PriorityModal
        open={priorityModal.open}
        onClose={() => setPriorityModal({ open: false, ids: [], initial: 5 })}
        onSubmit={applyPriority}
        initial={priorityModal.initial}
      />
    </div>
  );
}

// Re-export type to keep linters happy if Agent is unused at runtime.
export type _AgentRef = Agent;
