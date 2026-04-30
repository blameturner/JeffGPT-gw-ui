import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const SIZE: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-[10px]',
  md: 'px-3.5 py-1.5 text-[11px]',
};

const VARIANT: Record<Variant, string> = {
  primary:
    'border border-fg bg-fg text-bg hover:bg-fg/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/30',
  secondary:
    'border border-border bg-bg text-fg hover:border-fg hover:bg-panelHi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20',
  ghost:
    'border border-transparent bg-transparent text-muted hover:text-fg hover:bg-panelHi',
  danger:
    'border border-red-700 bg-bg text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/20',
};

export function Btn({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center gap-1.5 font-sans uppercase tracking-[0.18em] rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap',
        SIZE[size],
        VARIANT[variant],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
