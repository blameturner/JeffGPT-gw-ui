// Editorial light-mode status pill. One source of truth for queue / harvest /
// connector / generic status colour mapping. Pastel tinted background + darker
// ink text + hairline border matches the rest of the visual system.
import type { ReactNode } from 'react';

export type StatusTone =
  | 'queued'
  | 'inflight'
  | 'success'
  | 'warn'
  | 'error'
  | 'neutral';

const TONE: Record<StatusTone, string> = {
  queued: 'bg-amber-50 text-amber-900 border-amber-200',
  inflight: 'bg-sky-50 text-sky-900 border-sky-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warn: 'bg-amber-50 text-amber-900 border-amber-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  neutral: 'bg-panel text-muted border-border',
};

const STATUS_TO_TONE: Record<string, StatusTone> = {
  // queue-ish
  queued: 'queued',
  // in-flight family
  running: 'inflight',
  fetching: 'inflight',
  extracting: 'inflight',
  persisting: 'inflight',
  planning: 'inflight',
  scraping: 'inflight',
  dispatched: 'inflight',
  open: 'inflight',
  // success
  completed: 'success',
  done: 'success',
  ok: 'success',
  scraped: 'success',
  processed: 'success',
  verified: 'success',
  // warning
  degraded: 'warn',
  rejected: 'warn',
  snoozed: 'warn',
  // error
  failed: 'error',
  error: 'error',
  // neutral
  cancelled: 'neutral',
  closed: 'neutral',
  idle: 'neutral',
  no_chunks: 'neutral',
  no_queries: 'neutral',
};

export function toneFor(status: string | undefined | null): StatusTone {
  if (!status) return 'neutral';
  return STATUS_TO_TONE[status] ?? 'neutral';
}

export function StatusPill({
  status,
  tone,
  title,
  children,
  className = '',
}: {
  status?: string | null;
  tone?: StatusTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t: StatusTone = tone ?? toneFor(status);
  return (
    <span
      title={title}
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-sm text-[10px] uppercase tracking-[0.16em] font-sans whitespace-nowrap',
        TONE[t],
        className,
      ].join(' ')}
    >
      {t === 'inflight' && (
        <span className="w-1 h-1 rounded-full bg-current opacity-80 animate-blink" aria-hidden />
      )}
      {children ?? status ?? 'unknown'}
    </span>
  );
}
