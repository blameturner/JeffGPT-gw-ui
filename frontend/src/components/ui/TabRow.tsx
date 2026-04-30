import type { ReactNode } from 'react';

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  hint?: ReactNode;
}

// Canonical horizontal tab bar — bottom-border indicator, uppercase tracked
// labels. Matches the existing `/home` tab styling so the new pages don't feel
// like they were grafted on by a different hand.
export function TabRow<T extends string>({
  tabs,
  active,
  onChange,
  size = 'md',
}: {
  tabs: ReadonlyArray<TabDef<T>>;
  active: T;
  onChange: (id: T) => void;
  size?: 'sm' | 'md';
}) {
  const padding = size === 'sm' ? 'px-3 py-2' : 'px-4 py-2.5 sm:py-3';
  const tracking = size === 'sm' ? 'tracking-[0.16em]' : 'tracking-[0.18em]';
  return (
    <nav
      role="tablist"
      className="shrink-0 border-b border-border flex gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar"
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={[
              'group relative whitespace-nowrap border-b-2 -mb-px transition-colors font-sans uppercase text-[10px] sm:text-[11px]',
              padding,
              tracking,
              on
                ? 'border-fg text-fg'
                : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              {t.label}
              {t.hint && (
                <span className="text-[9px] text-muted/80 normal-case tracking-normal">
                  {t.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
