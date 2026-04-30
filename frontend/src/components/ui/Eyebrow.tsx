import type { ReactNode } from 'react';

// Small uppercase label used to title sections, tabs, drawer eyebrows, etc.
export function Eyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'text-[10px] uppercase tracking-[0.22em] text-muted font-sans',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
