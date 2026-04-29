import { useEffect, useMemo, useState } from 'react';
import type { AgentListRow, AgentType } from '../types';
import { instantiateTemplate, listTemplates } from '../api';
import { EmptyState } from '../../connectors/components/EmptyState';
import { PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';
import { AgentSidebarItem } from './AgentSidebarItem';
import { NewAgentDialog } from '../dialogs/NewAgentDialog';

type StatusFilter = 'active' | 'paused' | 'failing' | 'inactive';
type SortKey = 'last_run' | 'name' | 'type' | 'failures';

const ALL_TYPES: AgentType[] = ['document', 'queue', 'producer', 'responder', 'supervisor'];
const ALL_STATUSES: StatusFilter[] = ['active', 'paused', 'failing', 'inactive'];

function deriveStatusFilter(a: AgentListRow): StatusFilter {
  const failures = a.consecutive_failures ?? 0;
  if (a.active === false) return 'paused';
  if (failures >= 5) return 'failing';
  if (failures > 0) return 'failing';
  if (a.active) return 'active';
  return 'inactive';
}

export function AgentSidebar({
  agents,
  selectedId,
  onSelect,
  onCreated,
  error,
  onRetry,
}: {
  agents: AgentListRow[] | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreated: (id: number) => void;
  error: string | null;
  onRetry: () => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<AgentType>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<StatusFilter>>(new Set());
  const [hasCron, setHasCron] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasApi, setHasApi] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('last_run');
  const [busyTpl, setBusyTpl] = useState<string | null>(null);

  // Debounce the search input.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (agents ?? []).forEach((a) => (a.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [agents]);

  const filtered = useMemo(() => {
    if (!agents) return [];
    let rows = agents.filter((a) => {
      if (search) {
        const hay = `${a.name} ${a.display_name ?? ''} ${a.brief ?? ''} ${(a.tags ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (typeFilter.size && !typeFilter.has(a.type)) return false;
      if (statusFilter.size && !statusFilter.has(deriveStatusFilter(a))) return false;
      if (hasCron && !a.has_cron) return false;
      if (hasEmail && !a.has_email) return false;
      if (hasApi && !a.has_api_trigger) return false;
      if (tagFilter && !(a.tags ?? []).includes(tagFilter)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sortKey === 'name') return (a.display_name || a.name).localeCompare(b.display_name || b.name);
      if (sortKey === 'type') return a.type.localeCompare(b.type);
      if (sortKey === 'failures') return (b.consecutive_failures ?? 0) - (a.consecutive_failures ?? 0);
      // last_run desc
      const at = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
      const bt = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
      return bt - at;
    });
    return rows;
  }, [agents, search, typeFilter, statusFilter, hasCron, hasEmail, hasApi, tagFilter, sortKey]);

  function toggleType(t: AgentType) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }
  function toggleStatus(s: StatusFilter) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function instantiateByName(templateName: string, agentName: string) {
    setBusyTpl(templateName);
    try {
      const res = await listTemplates();
      const tpl = res.templates.find((t) => t.name.toLowerCase() === templateName.toLowerCase());
      if (!tpl) {
        setShowNew(true);
        return;
      }
      const agent = await instantiateTemplate(tpl.Id, { name: agentName });
      onCreated(agent.Id);
    } catch {
      setShowNew(true);
    } finally {
      setBusyTpl(null);
    }
  }

  const total = filtered.length;
  const display = total > 200 ? filtered.slice(0, 200) : filtered;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-3 border-b border-border space-y-2 bg-panel">
        <div className="flex items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search agents"
            className="flex-1 min-w-0 border border-border bg-bg px-3 py-1.5 text-sm focus:outline-none focus:border-fg"
          />
          <PrimaryButton onClick={() => setShowNew(true)}>+ New</PrimaryButton>
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_TYPES.map((t) => (
            <FilterChip key={t} active={typeFilter.has(t)} onClick={() => toggleType(t)}>
              {t}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_STATUSES.map((s) => (
            <FilterChip key={s} active={statusFilter.has(s)} onClick={() => toggleStatus(s)}>
              {s}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <FilterChip active={hasCron} onClick={() => setHasCron((v) => !v)}>cron</FilterChip>
          <FilterChip active={hasEmail} onClick={() => setHasEmail((v) => !v)}>email</FilterChip>
          <FilterChip active={hasApi} onClick={() => setHasApi((v) => !v)}>api</FilterChip>
        </div>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-full border border-border bg-bg px-2 py-1 text-xs focus:outline-none focus:border-fg"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">Sort</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="flex-1 border border-border bg-bg px-2 py-1 text-xs focus:outline-none focus:border-fg"
          >
            <option value="last_run">Last run</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="failures">Failures</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {error ? (
          <div className="p-4 text-sm space-y-2">
            <p className="text-red-700">{error}</p>
            <SecondaryButton onClick={onRetry}>Retry</SecondaryButton>
          </div>
        ) : agents == null ? (
          <div className="p-4 text-sm text-muted">Loading…</div>
        ) : agents.length === 0 ? (
          <EmptyState
            title="No agents yet"
            body="Pick a starter template or create your own."
            cta={
              <div className="flex flex-wrap gap-2 justify-center">
                <SecondaryButton
                  disabled={busyTpl !== null}
                  onClick={() => instantiateByName('Architect', 'Architect')}
                >
                  Architect
                </SecondaryButton>
                <SecondaryButton
                  disabled={busyTpl !== null}
                  onClick={() => instantiateByName('Researcher', 'Researcher')}
                >
                  Researcher
                </SecondaryButton>
                <SecondaryButton
                  disabled={busyTpl !== null}
                  onClick={() => instantiateByName('Secretary', 'Secretary')}
                >
                  Secretary
                </SecondaryButton>
              </div>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted">No agents match the current filters.</div>
        ) : (
          <>
            {display.map((row) => (
              <AgentSidebarItem
                key={row.Id}
                agent={row}
                selected={row.Id === selectedId}
                onClick={() => onSelect(row.Id)}
              />
            ))}
            {total > 200 && (
              <div className="p-3 text-[11px] text-muted text-center">
                Showing 200 of {total} — refine your filters.
              </div>
            )}
          </>
        )}
      </div>

      {showNew && (
        <NewAgentDialog
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            onCreated(id);
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-0.5 border rounded-sm transition-colors',
        active ? 'bg-fg text-bg border-fg' : 'bg-bg text-muted border-border hover:border-fg',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
