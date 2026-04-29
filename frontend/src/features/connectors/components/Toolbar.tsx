import type { ReactNode } from 'react';

export function Toolbar({
  title,
  count,
  search,
  onSearch,
  filter,
  primary,
}: {
  title: string;
  count?: number;
  search: string;
  onSearch: (next: string) => void;
  filter?: ReactNode;
  primary?: ReactNode;
}) {
  return (
    <div className="border-b border-border px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 bg-bg sticky top-0 z-10">
      <div className="flex items-baseline gap-2 mr-2">
        <h2 className="font-display text-xl tracking-tightest">{title}</h2>
        {typeof count === 'number' && (
          <span className="text-xs font-mono text-muted">{count}</span>
        )}
      </div>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search"
        className="flex-1 min-w-[160px] max-w-md border border-border bg-bg px-3 py-1.5 text-sm focus:outline-none focus:border-fg"
      />
      <div className="flex items-center gap-2 ml-auto">
        {filter}
        {primary}
      </div>
    </div>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        'text-[11px] uppercase tracking-[0.18em] font-sans border border-fg bg-fg text-bg px-3 py-2 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        'text-[11px] uppercase tracking-[0.18em] font-sans border border-border text-fg px-3 py-2 hover:border-fg transition disabled:opacity-40 disabled:cursor-not-allowed',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        'text-[11px] uppercase tracking-[0.18em] font-sans text-muted hover:text-fg px-2 py-2 transition disabled:opacity-40',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
