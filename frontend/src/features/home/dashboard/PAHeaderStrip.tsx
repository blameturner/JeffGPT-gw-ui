import { useState } from 'react';
import type { PAStatus } from '../../../api/home/types';
import { runPA } from '../../../api/home/pa';
import { useToast } from '../../../lib/toast/useToast';

interface Props {
  status: PAStatus;
  onPinged: () => void;
  onOpenMind: () => void;
  onOpenFacts: () => void;
}

function formatCooldown(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return 'soon';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function PAHeaderStrip({ status, onPinged, onOpenMind, onOpenFacts }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handlePing() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await runPA({ force: true });
      if (res.surfaced) {
        toast.success('PA surfaced something new.');
      } else {
        toast.info('Nothing new to surface right now.');
      }
      onPinged();
    } catch (err) {
      toast.error(`PA ping failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      window.setTimeout(() => setBusy(false), 3_000);
    }
  }

  const readyText = status.gap_ready
    ? 'PA ready'
    : `PA cooling down · ready in ${formatCooldown(status.seconds_until_auto_ready)}`;

  return (
    <div className="relative border-b border-border bg-panel/40">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2">
        {/* left: status + counters */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={[
              'inline-block w-1.5 h-1.5 rounded-full shrink-0',
              status.gap_ready ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500',
            ].join(' ')}
            aria-hidden
          />
          <span className="text-[11px] sm:text-[12px] font-sans text-fg truncate">
            {readyText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-sans uppercase tracking-[0.14em] text-muted">
          <button
            type="button"
            onClick={onOpenMind}
            className="border border-border px-1.5 py-0.5 hover:border-fg hover:text-fg transition-colors tabular-nums"
            title="Open ‘On my mind’ — warm topics and open loops"
          >
            <span className="font-display not-italic tabular-nums text-fg">
              {status.warm_topics}
            </span>{' '}
            warm
          </button>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={onOpenMind}
            className="border border-border px-1.5 py-0.5 hover:border-fg hover:text-fg transition-colors tabular-nums"
          >
            <span className="font-display not-italic tabular-nums text-fg">
              {status.open_loops}
            </span>{' '}
            open
          </button>
        </div>

        {/* right: actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFacts}
            className="hidden sm:inline-block text-[11px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg"
            title="What the PA knows about me"
          >
            What I know
          </button>
          <button
            type="button"
            onClick={onOpenFacts}
            className="sm:hidden text-[12px] font-sans text-muted hover:text-fg px-1.5 py-0.5 border border-border"
            aria-label="What the PA knows about me"
            title="What the PA knows about me"
          >
            ?
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePing()}
            className="border border-fg px-3 py-1.5 sm:py-1 text-[11px] uppercase tracking-[0.16em] font-sans text-fg hover:bg-fg hover:text-bg disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {busy ? 'Pinging…' : 'Catch me up ›'}
          </button>
        </div>
      </div>
    </div>
  );
}
