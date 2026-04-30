import type { ReactNode } from 'react';

// Calm, consistent empty state. Default copy is the project convention "no data".
export function Empty({
  title = 'no data',
  hint,
  children,
  compact = false,
  className = '',
}: {
  title?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        className={[
          'text-[11px] uppercase tracking-[0.18em] text-muted font-sans',
          className,
        ].join(' ')}
      >
        {title}
      </div>
    );
  }
  return (
    <div
      className={[
        'border border-dashed border-border rounded-md px-6 py-8 text-center',
        className,
      ].join(' ')}
    >
      <div className="font-display text-base tracking-tightest text-fg">{title}</div>
      {hint && <p className="mt-1 text-xs text-muted max-w-sm mx-auto">{hint}</p>}
      {children && <div className="mt-3 flex justify-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
