import type { ConnectorStatus } from '../types';

const TONE: Record<ConnectorStatus, { bg: string; fg: string; label: string }> = {
  verified: { bg: 'bg-emerald-50', fg: 'text-emerald-800', label: 'Verified' },
  send_only: { bg: 'bg-sky-50', fg: 'text-sky-800', label: 'Send only' },
  failed: { bg: 'bg-red-50', fg: 'text-red-800', label: 'Failed' },
  unverified: { bg: 'bg-panelHi', fg: 'text-muted', label: 'Unverified' },
};

export function StatusChip({
  status,
  size = 'sm',
}: {
  status?: ConnectorStatus | null;
  size?: 'sm' | 'md';
}) {
  const t = TONE[status ?? 'unverified'];
  const px = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span
      aria-label={`Status: ${t.label}`}
      className={`inline-flex items-center gap-1 rounded ${px} uppercase tracking-[0.12em] font-sans ${t.bg} ${t.fg} border border-border`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          status === 'verified'
            ? 'bg-emerald-600'
            : status === 'failed'
              ? 'bg-red-600'
              : status === 'send_only'
                ? 'bg-sky-600'
                : 'bg-muted'
        }`}
      />
      {t.label}
    </span>
  );
}
