import type { ReactNode } from 'react';

// Canonical page header — Fraunces title, optional eyebrow above, optional
// right-side meta or actions. Use across all top-level routes.
export function PageHeader({
  title,
  eyebrow,
  right,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-border bg-bg/95 backdrop-blur-sm px-4 sm:px-8 py-3 sm:py-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1 font-sans">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-2xl sm:text-[28px] tracking-tightest leading-none truncate">
            {title}
          </h1>
        </div>
        {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}
