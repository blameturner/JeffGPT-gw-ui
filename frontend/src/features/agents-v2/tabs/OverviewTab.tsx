import type { Agent } from '../types';
import { BudgetBar } from '../components/BudgetBar';
import { AgentStatusPill, deriveStatus } from '../components/AgentStatusPill';

function fmt(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function EditLabel({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted font-sans">{label}</span>
      <button
        type="button"
        onClick={onEdit}
        className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg"
      >
        Edit
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-panel">
      <header className="border-b border-border px-4 py-2">
        <h3 className="font-display text-sm tracking-tightest uppercase">{title}</h3>
      </header>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

export function OverviewTab({
  agent,
  onJumpToTab,
}: {
  agent: Agent;
  onJumpToTab: (tab: string) => void;
}) {
  const status = deriveStatus(agent);
  const jumpConfig = () => onJumpToTab('configure');

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="At a glance">
          <div>
            <EditLabel label="Name" onEdit={jumpConfig} />
            <div className="text-sm font-sans">{fmt(agent.display_name || agent.name)}</div>
          </div>
          <div>
            <EditLabel label="Type" onEdit={jumpConfig} />
            <div className="text-sm font-sans uppercase tracking-[0.14em]">{fmt(agent.type)}</div>
          </div>
          <div>
            <EditLabel label="Model" onEdit={jumpConfig} />
            <div className="text-sm font-mono">{fmt(agent.model)}</div>
          </div>
          <div>
            <EditLabel label="Persona" onEdit={jumpConfig} />
            <div className="text-xs text-muted whitespace-pre-wrap font-mono">{fmt(agent.persona)}</div>
          </div>
          <div>
            <EditLabel label="Brief" onEdit={jumpConfig} />
            <div className="text-xs text-muted whitespace-pre-wrap font-mono">{fmt(agent.brief)}</div>
          </div>
        </Card>

        <Card title="Today">
          <BudgetBar label="Runs" value={agent.runs_today ?? 0} max={agent.max_runs_per_day ?? 0} />
          <BudgetBar label="Tokens" value={agent.tokens_today ?? 0} max={agent.max_tokens_per_day ?? 0} />
          <BudgetBar
            label="Cost"
            value={agent.cost_usd_today ?? 0}
            max={agent.max_cost_usd_per_day ?? 0}
            unit="USD"
          />
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Last run</span>
              <span className="text-xs font-mono">{formatTime(agent.last_run_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Status</span>
              <AgentStatusPill status={status} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Avg duration (last 20)</span>
              <span className="text-xs font-mono">
                {agent.avg_duration_seconds != null ? `${agent.avg_duration_seconds.toFixed(1)}s` : '—'}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Pipeline">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Next run</span>
            <span className="text-xs font-mono">{formatTime(agent.next_run_at)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Pending assignments</span>
            <button
              type="button"
              onClick={() => onJumpToTab('activity')}
              className="text-xs font-mono underline-offset-2 hover:underline"
            >
              {agent.pending_assignments_count ?? 0}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Pending approvals</span>
            <a
              href="/agents?view=approvals"
              className="text-xs font-mono underline-offset-2 hover:underline"
            >
              {agent.pending_approvals_count ?? 0} — View approvals
            </a>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Active workers</span>
            <span className="text-xs font-mono">{agent.active_workers_count ?? 0}</span>
          </div>
        </Card>
      </div>

      <section className="border border-border bg-panel p-4">
        <h3 className="font-display text-sm tracking-tightest uppercase mb-2">Recent activity</h3>
        <p className="text-xs text-muted">Switch to Activity tab to view runs and assignments.</p>
      </section>
    </div>
  );
}
