import type { AgentStatusKind } from '../types';

const TONES: Record<
  AgentStatusKind,
  { dot: string; label: string; tone: string; reason: string }
> = {
  active: {
    dot: 'bg-emerald-500',
    label: 'Active',
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    reason: 'Healthy and accepting assignments.',
  },
  paused: {
    dot: 'bg-muted',
    label: 'Paused',
    tone: 'text-muted bg-panelHi border-border',
    reason: 'Manually paused. Resume to accept new assignments.',
  },
  failing: {
    dot: 'bg-amber-500',
    label: 'Failing',
    tone: 'text-amber-900 bg-amber-50 border-amber-200',
    reason: 'Recent failures detected.',
  },
  circuit_broken: {
    dot: 'bg-red-600',
    label: 'Circuit broken',
    tone: 'text-red-900 bg-red-50 border-red-200',
    reason: 'Too many consecutive failures. Reset circuit to retry.',
  },
  inactive: {
    dot: 'bg-border',
    label: 'Inactive',
    tone: 'text-muted bg-panelHi border-border',
    reason: 'Not configured or disabled.',
  },
};

export function AgentStatusPill({ status, reason }: { status: AgentStatusKind; reason?: string }) {
  const t = TONES[status];
  return (
    <span
      title={reason ?? t.reason}
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans border ${t.tone}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

export function deriveStatus(agent: {
  active?: boolean;
  consecutive_failures?: number | null;
  pause_until?: string | null;
  circuit_breaker_threshold?: number | null;
}): AgentStatusKind {
  const failures = agent.consecutive_failures ?? 0;
  const threshold = agent.circuit_breaker_threshold ?? 5;
  if (agent.active === false || agent.pause_until) return 'paused';
  if (failures >= threshold) return 'circuit_broken';
  if (failures > 0) return 'failing';
  if (agent.active) return 'active';
  return 'inactive';
}
