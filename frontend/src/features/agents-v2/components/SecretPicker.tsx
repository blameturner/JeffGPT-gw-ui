import { useEffect, useState } from 'react';
import { listSecrets } from '../../connectors/api';
import type { Secret } from '../../connectors/types';

export function SecretPicker({
  value,
  onChange,
}: {
  value: string[] | null | undefined;
  onChange: (next: string[]) => void;
}) {
  const [secrets, setSecrets] = useState<Secret[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setError(null);
    setSecrets(null);
    listSecrets()
      .then((res) => {
        if (!alive) return;
        setSecrets(res.secrets);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const selected = value ?? [];
  const candidates = (secrets ?? []).filter(
    (s) =>
      !selected.includes(s.name) &&
      (!query || s.name.toLowerCase().includes(query.toLowerCase())),
  );

  function toggle(name: string) {
    if (selected.includes(name)) onChange(selected.filter((x) => x !== name));
    else onChange([...selected, name]);
  }

  if (error) {
    return (
      <div className="text-xs text-red-700 flex items-center gap-2">
        <span>Failed to load secrets: {error}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline">
          Retry
        </button>
      </div>
    );
  }
  if (secrets == null) return <div className="text-xs text-muted">Loading…</div>;
  if (secrets.length === 0) {
    return <div className="text-xs text-muted">No secrets registered.</div>;
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 border border-border bg-panelHi px-2 py-0.5 text-[11px] font-mono"
            >
              {n}
              <button
                type="button"
                onClick={() => toggle(n)}
                className="text-muted hover:text-fg"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search secrets to add…"
        className="w-full border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:border-fg"
      />
      {candidates.length > 0 && (
        <div className="border border-border bg-bg max-h-48 overflow-auto">
          {candidates.slice(0, 50).map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => toggle(s.name)}
              className="block w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-panelHi"
            >
              {s.name}
              <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-muted">
                {s.kind}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
