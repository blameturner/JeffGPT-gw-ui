// frontend/src/lib/utils/formatRelative.ts
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (Math.abs(diff) < 45) return 'just now';
  const past = diff >= 0;
  const abs = Math.abs(diff);
  const unit = (n: number, s: string) =>
    `${Math.round(n)}${s} ${past ? 'ago' : 'from now'}`;
  if (abs < 3600) return unit(abs / 60, 'm');
  if (abs < 86400) return unit(abs / 3600, 'h');
  if (abs < 86400 * 7) return unit(abs / 86400, 'd');
  return then.toLocaleDateString();
}

export function formatSecondsSinceChat(seconds: number | null | undefined): string {
  if (seconds == null) return 'no chats yet';
  if (seconds < 60) return `${Math.round(seconds)}s since last chat`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m since last chat`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h since last chat`;
  return `${Math.round(seconds / 86400)}d since last chat`;
}
