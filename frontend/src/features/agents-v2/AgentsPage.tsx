import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AgentsTwoPane } from './shell/AgentsTwoPane';
import { AssignmentsGlobal } from './global/AssignmentsGlobal';
import { ApprovalsGlobal } from './global/ApprovalsGlobal';
import { IncidentsGlobal } from './global/IncidentsGlobal';
import { TemplatesGlobal } from './global/TemplatesGlobal';

export type GlobalTabId = 'my' | 'assignments' | 'approvals' | 'incidents' | 'templates';

const TABS: { id: GlobalTabId; label: string }[] = [
  { id: 'my', label: 'My Agents' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'templates', label: 'Templates' },
];

export function AgentsPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/agents' }) as { view?: string; id?: string } | undefined;
  const initial = (TABS.find((t) => t.id === (search?.view as GlobalTabId))?.id ?? 'my') as GlobalTabId;
  const [tab, setTab] = useState<GlobalTabId>(initial);

  useEffect(() => {
    if (search?.view !== tab) {
      navigate({
        to: '/agents',
        search: (prev: any) => ({ ...prev, view: tab }),
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const next = (TABS.find((t) => t.id === (search?.view as GlobalTabId))?.id ?? 'my') as GlobalTabId;
    if (next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search?.view]);

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <header className="shrink-0 border-b border-border px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-xl sm:text-2xl tracking-tightest">Agents</h1>
      </header>

      <nav className="shrink-0 border-b border-border px-2 sm:px-8 flex gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar bg-bg">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0">
        {tab === 'my' && <AgentsTwoPane selectedId={search?.id ? Number(search.id) : null} />}
        {tab === 'assignments' && <AssignmentsGlobal />}
        {tab === 'approvals' && <ApprovalsGlobal />}
        {tab === 'incidents' && <IncidentsGlobal />}
        {tab === 'templates' && <TemplatesGlobal />}
      </div>
    </div>
  );
}
