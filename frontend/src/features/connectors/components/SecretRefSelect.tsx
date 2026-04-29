import { useEffect, useMemo, useState } from 'react';
import { listSecrets } from '../api';
import type { Secret } from '../types';

// Autocomplete for secret-by-name references with inline "+ New secret" hook.
// Stores the secret NAME (not id) on the connector — names are stable per org
// while ids may not be exposed in remote payloads.
export function SecretRefSelect({
  value,
  onChange,
  onCreateNew,
  disabled,
  placeholder = 'Pick or type a secret name…',
}: {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  onCreateNew?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [secrets, setSecrets] = useState<Secret[] | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    listSecrets()
      .then((res) => {
        if (!cancelled) setSecrets(res.secrets);
      })
      .catch(() => {
        if (!cancelled) setSecrets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!secrets) return [];
    const needle = (q || value || '').toLowerCase();
    if (!needle) return secrets.slice(0, 12);
    return secrets.filter((s) => s.name.toLowerCase().includes(needle)).slice(0, 12);
  }, [secrets, q, value]);

  return (
    <div className="relative">
      <input
        value={open ? q : value ?? ''}
        onFocus={() => {
          setOpen(true);
          setQ(value ?? '');
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full border border-border bg-bg px-3 py-2 text-sm font-mono focus:outline-none focus:border-fg disabled:opacity-60"
      />
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 border border-border bg-bg shadow-card max-h-72 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted">No matching secrets.</div>
          )}
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.name);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-panelHi"
            >
              <span className="font-mono">{s.name}</span>
              <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-muted">{s.kind}</span>
            </button>
          ))}
          {onCreateNew && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onCreateNew();
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm border-t border-border hover:bg-panelHi text-fg"
            >
              + New secret
            </button>
          )}
        </div>
      )}
    </div>
  );
}
