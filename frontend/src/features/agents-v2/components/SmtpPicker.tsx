import { useEffect, useState } from 'react';
import { listSmtp } from '../../connectors/api';
import type { SmtpAccount } from '../../connectors/types';
import { StatusChip } from '../../connectors/components/StatusChip';

export function SmtpPicker({
  value,
  onChange,
}: {
  value: number[] | null | undefined;
  onChange: (next: number[]) => void;
}) {
  const [accounts, setAccounts] = useState<SmtpAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setError(null);
    setAccounts(null);
    listSmtp()
      .then((res) => {
        if (!alive) return;
        setAccounts(res.accounts);
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
  const selectedAcc = (accounts ?? []).filter((a) => selected.includes(a.id));
  const candidates = (accounts ?? []).filter(
    (a) =>
      !selected.includes(a.id) &&
      (!query ||
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.from_email.toLowerCase().includes(query.toLowerCase())),
  );

  function toggle(id: number) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  if (error) {
    return (
      <div className="text-xs text-red-700 flex items-center gap-2">
        <span>Failed to load SMTP: {error}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline">
          Retry
        </button>
      </div>
    );
  }
  if (accounts == null) return <div className="text-xs text-muted">Loading…</div>;
  if (accounts.length === 0) {
    return <div className="text-xs text-muted">No SMTP accounts registered.</div>;
  }

  return (
    <div className="space-y-3">
      {selectedAcc.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedAcc.map((a) => (
            <div key={a.id} className="border border-border bg-panel p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-sm">{a.name}</span>
                <StatusChip status={a.status ?? null} />
              </div>
              <div className="text-[11px] font-mono text-muted truncate">{a.from_email}</div>
              <button
                type="button"
                onClick={() => toggle(a.id)}
                className="text-[10px] uppercase tracking-[0.18em] text-red-700 hover:text-red-900"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SMTP accounts to add…"
          className="w-full border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:border-fg"
        />
        {candidates.length > 0 && (
          <div className="border border-border bg-bg max-h-48 overflow-auto">
            {candidates.slice(0, 50).map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => toggle(a.id)}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-panelHi"
              >
                <span className="font-sans">{a.name}</span>
                <span className="ml-2 text-[10px] font-mono text-muted">{a.from_email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
