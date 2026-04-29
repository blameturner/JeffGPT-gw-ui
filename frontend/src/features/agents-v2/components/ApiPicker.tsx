import { useEffect, useState } from 'react';
import { listApis } from '../../connectors/api';
import type { ApiConnection } from '../../connectors/types';
import { StatusChip } from '../../connectors/components/StatusChip';
import { Modal } from '../../connectors/components/Modal';

export function ApiPicker({
  value,
  onChange,
}: {
  value: number[] | null | undefined;
  onChange: (next: number[]) => void;
}) {
  const [apis, setApis] = useState<ApiConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showPrompt, setShowPrompt] = useState<ApiConnection | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setError(null);
    setApis(null);
    listApis()
      .then((res) => {
        if (!alive) return;
        setApis(res.apis);
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
  const selectedApis = (apis ?? []).filter((a) => selected.includes(a.id));
  const candidates = (apis ?? []).filter(
    (a) =>
      !selected.includes(a.id) &&
      (!query || a.name.toLowerCase().includes(query.toLowerCase())),
  );

  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (error) {
    return (
      <div className="text-xs text-red-700 flex items-center gap-2">
        <span>Failed to load APIs: {error}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline">
          Retry
        </button>
      </div>
    );
  }
  if (apis == null) return <div className="text-xs text-muted">Loading…</div>;
  if (apis.length === 0) {
    return <div className="text-xs text-muted">No APIs registered.</div>;
  }

  return (
    <div className="space-y-3">
      {selectedApis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedApis.map((a) => (
            <div key={a.id} className="border border-border bg-panel p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-sm">{a.name}</span>
                <StatusChip status={a.status ?? null} />
              </div>
              <div className="text-[11px] font-mono text-muted truncate">{a.base_url}</div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPrompt(a)}
                  className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg"
                >
                  View usage prompt
                </button>
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="text-[10px] uppercase tracking-[0.18em] text-red-700 hover:text-red-900 ml-auto"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search APIs to add…"
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
                <span className="ml-2 text-[10px] font-mono text-muted">{a.base_url}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Modal
        open={!!showPrompt}
        onClose={() => setShowPrompt(null)}
        title={showPrompt ? `${showPrompt.name} — usage prompt` : ''}
        size="lg"
      >
        <pre className="font-mono text-xs whitespace-pre-wrap">
          {showPrompt?.usage_prompt ?? '(no usage prompt set)'}
        </pre>
      </Modal>
    </div>
  );
}
