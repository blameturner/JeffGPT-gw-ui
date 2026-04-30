import type { ReactNode } from 'react';

// Compact label/control wrapper used inside dense forms.
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={['block', className].join(' ')}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted mb-1 font-sans">
        {label}
      </div>
      {children}
      {hint && <div className="text-[10px] text-muted mt-1">{hint}</div>}
    </label>
  );
}
