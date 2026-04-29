import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { listAgentsRich } from '../api';
import type { Agent, AgentListRow } from '../types';
import { AgentSidebar } from './AgentSidebar';
import { AgentDetailShell } from './AgentDetailShell';

export function AgentsTwoPane({ selectedId }: { selectedId: number | null }) {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await listAgentsRich();
      setAgents(res.agents);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSelect = useCallback(
    (id: number) => {
      void navigate({
        to: '/agents',
        search: (prev: any) => ({ ...prev, id: String(id) }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleAgentChanged = useCallback(
    (next: Agent) => {
      // Update the corresponding row in our cached list optimistically.
      setAgents((prev) =>
        prev?.map((row) =>
          row.Id === next.Id
            ? {
                ...row,
                name: next.name,
                display_name: next.display_name,
                color_hex: next.color_hex ?? null,
                active: next.active,
                consecutive_failures: next.consecutive_failures ?? null,
                last_run_at: next.last_run_at ?? null,
                tags: next.tags ?? null,
                brief: next.brief ?? null,
              }
            : row,
        ) ?? null,
      );
    },
    [],
  );

  return (
    <div className="h-full flex">
      <aside className="shrink-0 w-[320px] border-r border-border min-h-0 flex flex-col bg-panel">
        <AgentSidebar
          agents={agents}
          selectedId={selectedId}
          onSelect={handleSelect}
          onCreated={(id) => {
            void refresh();
            handleSelect(id);
          }}
          error={error}
          onRetry={() => {
            setError(null);
            void refresh();
          }}
        />
      </aside>
      <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {selectedId ? (
          <AgentDetailShell
            agentId={selectedId}
            onChanged={handleAgentChanged}
            onDeleted={() => {
              void refresh();
              void navigate({ to: '/agents', search: { view: 'my' } as any, replace: true });
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            Select an agent to view details.
          </div>
        )}
      </main>
    </div>
  );
}
