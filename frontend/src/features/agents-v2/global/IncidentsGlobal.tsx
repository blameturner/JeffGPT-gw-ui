import { useEffect, useMemo, useState } from 'react';
import { listAgentsRich, listIncidents, resolveIncident } from '../api';
import type { AgentIncident, AgentListRow } from '../types';
import { Modal } from '../../connectors/components/Modal';
import { Field, SelectInput, TextArea, TextInput } from '../../connectors/components/Field';
import { PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';
import { EmptyState } from '../../connectors/components/EmptyState';

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function KindChip({ kind }: { kind: string }) {
  return (
    <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans text-fg">
      {kind}
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
    </div>
  );
}

export function IncidentsGlobal() {
  const [items, setItems] = useState<AgentIncident[]>([]);
  const [agents, setAgents] = useState<AgentListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterAgents, setFilterAgents] = useState<number[]>([]);
  const [filterKind, setFilterKind] = useState<string>('all');
  const [showResolved, setShowResolved] = useState<boolean>(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [active, setActive] = useState<AgentIncident | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    listAgentsRich().then((r) => setAgents(r.agents)).catch(() => setAgents([]));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // TODO: subscribe to incidents channel for live updates
      const res = await listIncidents({ resolved: showResolved });
      let list = res.incidents;
      if (filterAgents.length > 0) list = list.filter((i) => filterAgents.includes(i.agent_id));
      if (filterKind !== 'all') list = list.filter((i) => i.kind === filterKind);
      setItems(list);
    } catch (e) {
      setError((e as Error).message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResolved, filterAgents.join(','), filterKind]);

  const kinds = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.kind));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  function toggleSel(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function doResolve() {
    if (!active) return;
    try {
      await resolveIncident(active.Id, resolveNote);
      setActive(null);
      setResolveNote('');
      load();
    } catch (e) {
      setError((e as Error).message || 'Failed to resolve');
    }
  }

  async function doBulkResolve() {
    const ids = Array.from(selected);
    for (const id of ids) {
      try {
        await resolveIncident(id, resolveNote);
      } catch {
        // ignore
      }
    }
    setBulkOpen(false);
    setResolveNote('');
    setSelected(new Set());
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <AgentMultiSelect agents={agents} selected={filterAgents} onChange={setFilterAgents} />
        </div>
        <SelectInput value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={showResolved ? 'resolved' : 'open'}
          onChange={(e) => setShowResolved(e.target.value === 'resolved')}
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </SelectInput>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 border border-border bg-panel px-3 py-2">
          <span className="text-xs font-mono text-muted">{selected.size} selected</span>
          <PrimaryButton onClick={() => setBulkOpen(true)}>
            Resolve {selected.size} selected
          </PrimaryButton>
          <SecondaryButton onClick={() => setSelected(new Set())}>Clear</SecondaryButton>
        </div>
      )}

      {error && (
        <div className="border border-red-600/40 bg-panel px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <SecondaryButton onClick={load}>Retry</SecondaryButton>
        </div>
      )}

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel border-b border-border">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === items.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(items.map((r) => r.Id)) : new Set())
                  }
                />
              </th>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Agent</th>
              <th className="px-2 py-2">Kind</th>
              <th className="px-2 py-2">Reason</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-2 py-3">
                        <div className="h-3 w-full animate-pulse bg-panel" />
                      </td>
                    ))}
                  </tr>
                ))
              : items.map((r) => (
                  <tr
                    key={r.Id}
                    onClick={() => setActive(r)}
                    className="border-b border-border cursor-pointer hover:bg-panel"
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.Id)}
                        onChange={() => toggleSel(r.Id)}
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
                      <KindChip kind={r.kind} />
                    </td>
                    <td className="px-2 py-2 max-w-[420px] truncate font-mono text-xs">
                      {r.reason}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{fmtTime(r.created_at)}</td>
                    <td className="px-2 py-2 text-xs">
                      {r.resolved ? (
                        <span className="text-emerald-700">resolved</span>
                      ) : (
                        <span className="text-red-700">open</span>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && !error && (
          <EmptyState title="No incidents" body="No incidents matching your filters." />
        )}
      </div>

      <Modal
        open={!!active}
        onClose={() => {
          setActive(null);
          setResolveNote('');
        }}
        size="md"
        title={active ? `Incident #${active.Id} · ${active.kind}` : ''}
        footer={
          active && !active.resolved ? (
            <div className="flex justify-end gap-2">
              <SecondaryButton
                onClick={() => {
                  setActive(null);
                  setResolveNote('');
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={doResolve}>Resolve</PrimaryButton>
            </div>
          ) : null
        }
      >
        {active && (
          <div className="space-y-3">
            <Field label="Reason">
              <pre className="whitespace-pre-wrap break-words bg-panel border border-border p-3 font-mono text-xs">
                {active.reason}
              </pre>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Created">
                <div className="text-sm font-mono">{fmtTime(active.created_at)}</div>
              </Field>
              <Field label="Resolved at">
                <div className="text-sm font-mono">{fmtTime(active.resolved_at)}</div>
              </Field>
            </div>
            {active.resolved && active.resolved_note && (
              <Field label="Resolution note">
                <div className="text-sm whitespace-pre-wrap font-mono">{active.resolved_note}</div>
              </Field>
            )}
            {!active.resolved && (
              <Field label="Resolution note">
                <TextArea
                  rows={4}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                />
              </Field>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        size="sm"
        title={`Resolve ${selected.size} incidents`}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setBulkOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={doBulkResolve}>Resolve all</PrimaryButton>
          </div>
        }
      >
        <Field label="Resolution note">
          <TextArea
            rows={4}
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
