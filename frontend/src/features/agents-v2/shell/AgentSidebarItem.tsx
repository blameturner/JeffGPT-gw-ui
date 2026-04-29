import { AgentColorAvatar } from '../components/AgentColorAvatar';
import type { AgentListRow } from '../types';

function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function EnvelopeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}
function PlugIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}

export function AgentSidebarItem({
  agent,
  selected,
  onClick,
}: {
  agent: AgentListRow;
  selected: boolean;
  onClick: () => void;
}) {
  const failures = agent.consecutive_failures ?? 0;
  const broken = failures >= 5;
  const inactive = agent.active === false;
  const dotClass = inactive
    ? 'bg-border'
    : broken
      ? 'bg-red-600'
      : failures > 0
        ? 'bg-amber-500'
        : agent.active
          ? 'bg-emerald-500'
          : 'bg-border';

  const accent = selected ? agent.color_hex || undefined : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2 border-l-4 border-b border-border min-h-[72px]',
        selected ? 'bg-panelHi' : 'bg-panel hover:bg-panelHi',
      ].join(' ')}
      style={{ borderLeftColor: selected ? accent || 'currentColor' : 'transparent' }}
    >
      <div className="flex items-center gap-2">
        <AgentColorAvatar name={agent.display_name || agent.name} colorHex={agent.color_hex} size={24} />
        <span className="font-sans font-semibold text-sm truncate flex-1 min-w-0">
          {agent.display_name || agent.name}
        </span>
        <span className="bg-panelHi border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">
          {agent.type}
        </span>
      </div>
      <div className="text-xs text-muted mt-1 truncate">{agent.brief || '—'}</div>
      <div className="mt-1 flex items-center gap-2 text-muted">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`}
          title={broken ? 'Circuit broken' : failures > 0 ? 'Failing' : agent.active ? 'Active' : 'Inactive'}
        />
        {agent.has_cron && (
          <span title="Has cron schedule">
            <ClockIcon />
          </span>
        )}
        {agent.has_email && (
          <span title="Email trigger">
            <EnvelopeIcon />
          </span>
        )}
        {agent.has_api_trigger && (
          <span title="API trigger">
            <PlugIcon />
          </span>
        )}
        {agent.has_webhook && (
          <span title="Webhook trigger">
            <LinkIcon />
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono">{relativeTime(agent.last_run_at)}</span>
      </div>
    </button>
  );
}
