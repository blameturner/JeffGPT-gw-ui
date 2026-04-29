import { useCallback, useEffect, useState } from 'react';
import { getAgentFull, pauseAgent, resumeAgent } from '../api';
import type { Agent } from '../types';
import { AgentColorAvatar } from '../components/AgentColorAvatar';
import { AgentStatusPill, deriveStatus } from '../components/AgentStatusPill';
import { OverviewTab } from '../tabs/OverviewTab';
import { ConfigureTab } from '../tabs/ConfigureTab';
import { TriggersTab } from '../tabs/TriggersTab';
import { ToolsApisTab } from '../tabs/ToolsApisTab';
import { OutputTab } from '../tabs/OutputTab';
import { SafetyTab } from '../tabs/SafetyTab';
import { ActivityTab } from '../tabs/ActivityTab';
import { IncidentsTab } from '../tabs/IncidentsTab';
import { RunNowDialog } from '../dialogs/RunNowDialog';
import { TestPromptDialog } from '../dialogs/TestPromptDialog';

type TabId =
  | 'overview'
  | 'configure'
  | 'triggers'
  | 'tools'
  | 'output'
  | 'safety'
  | 'activity'
  | 'incidents';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'configure', label: 'Configure' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'tools', label: 'Tools & APIs' },
  { id: 'output', label: 'Artifact / Output' },
  { id: 'safety', label: 'Safety & Limits' },
  { id: 'activity', label: 'Activity' },
  { id: 'incidents', label: 'Incidents' },
];

export function AgentDetailShell({
  agentId,
  onChanged,
  onDeleted,
}: {
  agentId: number;
  onChanged: (next: Agent) => void;
  onDeleted: () => void;
}) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [showRunNow, setShowRunNow] = useState(false);
  const [showTestPrompt, setShowTestPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const a = await getAgentFull(agentId);
      setAgent(a);
      onChanged(a);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentId, onChanged]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateAgent = useCallback(
    (next: Agent) => {
      setAgent(next);
      onChanged(next);
    },
    [onChanged],
  );

  async function togglePause() {
    if (!agent) return;
    setBusy(true);
    try {
      const next = agent.active === false || agent.pause_until ? await resumeAgent(agent.Id) : await pauseAgent(agent.Id);
      updateAgent(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !agent) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">Loading agent…</div>
    );
  }
  if (error && !agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm">
        <span className="text-red-700">{error}</span>
        <button onClick={refresh} className="text-[11px] uppercase tracking-[0.18em] border border-border px-3 py-2 hover:border-fg">
          Retry
        </button>
      </div>
    );
  }
  if (!agent) return null;

  const status = deriveStatus(agent);
  const isPaused = agent.active === false || !!agent.pause_until;

  return (
    <div className="h-full flex flex-col">
      <header
        className="shrink-0 border-b border-border bg-bg"
        style={agent.color_hex ? { boxShadow: `inset 4px 0 0 0 ${agent.color_hex}` } : undefined}
      >
        <div className="px-6 py-4 flex items-center gap-4">
          <AgentColorAvatar name={agent.display_name || agent.name} colorHex={agent.color_hex} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-display text-2xl tracking-tightest truncate">
                {agent.display_name || agent.name}
              </h2>
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted bg-panelHi border border-border px-2 py-0.5 rounded">
                {agent.type}
              </span>
              <AgentStatusPill status={status} />
            </div>
            {agent.description && (
              <p className="text-xs text-muted mt-1 truncate">{agent.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowRunNow(true)}
              className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg bg-fg text-bg px-3 py-2"
            >
              Run now
            </button>
            <button
              onClick={togglePause}
              disabled={busy}
              className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border px-3 py-2 hover:border-fg disabled:opacity-50"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => setShowTestPrompt(true)}
              className="text-[11px] uppercase tracking-[0.18em] font-sans text-muted hover:text-fg px-2 py-2"
              title="Test prompt"
            >
              Test
            </button>
          </div>
        </div>
        <nav className="px-2 sm:px-6 flex gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'px-3 py-2 text-[10px] uppercase tracking-[0.14em] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'overview' && <OverviewTab agent={agent} onJumpToTab={setTab as (t: string) => void} />}
        {tab === 'configure' && <ConfigureTab agent={agent} onChanged={updateAgent} />}
        {tab === 'triggers' && <TriggersTab agent={agent} onChanged={updateAgent} />}
        {tab === 'tools' && <ToolsApisTab agent={agent} onChanged={updateAgent} />}
        {tab === 'output' && <OutputTab agent={agent} onChanged={updateAgent} />}
        {tab === 'safety' && <SafetyTab agent={agent} onChanged={updateAgent} onDeleted={onDeleted} />}
        {tab === 'activity' && <ActivityTab agent={agent} />}
        {tab === 'incidents' && <IncidentsTab agent={agent} />}
      </div>

      {showRunNow && (
        <RunNowDialog
          agent={agent}
          onClose={() => setShowRunNow(false)}
          onQueued={() => {
            setShowRunNow(false);
            setTab('activity');
          }}
        />
      )}
      {showTestPrompt && (
        <TestPromptDialog agent={agent} onClose={() => setShowTestPrompt(false)} />
      )}
    </div>
  );
}
