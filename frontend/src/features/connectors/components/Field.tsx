import type { ReactNode } from 'react';

// Tiny labeled-field wrapper used by detail drawers and modals.
export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[11px] uppercase tracking-[0.14em] text-muted font-sans">
        {label}
        {required && <span className="text-red-700 ml-1">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-[11px] text-muted">{hint}</span>}
      {error && <span className="block text-[11px] text-red-700">{error}</span>}
    </label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean },
) {
  const { invalid, className, ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        'w-full border bg-bg px-3 py-2 text-sm focus:outline-none transition-colors',
        invalid ? 'border-red-500 focus:border-red-700' : 'border-border focus:border-fg',
        className ?? '',
      ].join(' ')}
    />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean },
) {
  const { invalid, className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={[
        'w-full border bg-bg px-3 py-2 text-sm focus:outline-none transition-colors',
        invalid ? 'border-red-500 focus:border-red-700' : 'border-border focus:border-fg',
        className ?? '',
      ].join(' ')}
    />
  );
}

export function SelectInput(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={[
        'w-full border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:border-fg',
        className ?? '',
      ].join(' ')}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full border transition-colors',
        checked ? 'bg-fg border-fg' : 'bg-panel border-border',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 rounded-full bg-bg transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
        ].join(' ')}
      />
    </button>
  );
}
