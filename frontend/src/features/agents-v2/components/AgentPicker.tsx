import { useEffect, useMemo, useState } from 'react';
import { listAgentsRich } from '../api';
import type { AgentListRow } from '../types';

type CommonProps = {
  excludeId?: number;
  placeholder?: string;
};

type SingleProps = CommonProps & {
  multi?: false;
  value: number | null | undefined;
  onChange: (next: number | null) => void;
};

type MultiProps = CommonProps & {
  multi: true;
  value: number[] | null | undefined;
  onChange: (next: number[]) => void;
};

export type AgentPickerProps = SingleProps | MultiProps;

export function AgentPicker(props: AgentPickerProps) {
  const { excludeId, placeholder } = props;
  const [agents, setAgents] = useState<AgentListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    setAgents(null);
    listAgentsRich()
      .then((res) => {
        if (!alive) return;
        setAgents(res.agents);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const byId = useMemo(() => {
    const m = new Map<number, AgentListRow>();
    (agents ?? []).forEach((a) => m.set(a.Id, a));
    return m;
  }, [agents]);

  const selectedIds: number[] = props.multi
    ? props.value ?? []
    : props.value != null
      ? [props.value]
      : [];

  const candidates = (agents ?? []).filter((a) => {
    if (excludeId != null && a.Id === excludeId) return false;
    if (selectedIds.includes(a.Id) && props.multi) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.display_name ?? '').toLowerCase().includes(q)
    );
  });

  function pick(id: number) {
    if (props.multi) {
      props.onChange([...(props.value ?? []), id]);
    } else {
      props.onChange(id);
    }
    setQuery('');
    setOpen(false);
  }

  function remove(id: number) {
    if (props.multi) {
      props.onChange((props.value ?? []).filter((x) => x !== id));
    } else {
      props.onChange(null);
    }
  }

  if (error) {
    return (
      <div className="text-xs text-red-700 flex items-center gap-2">
        <span>Failed to load agents: {error}</span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (agents == null) {
    return <div className="text-xs text-muted">Loading…</div>;
  }

  if (agents.length === 0) {
    return <div className="text-xs text-muted">No agents available.</div>;
  }

  return (
    <div className="space-y-1">
      {props.multi && selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const a = byId.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 border border-border bg-panelHi px-2 py-0.5 text-[11px] font-sans"
              >
                <span>{a?.display_name || a?.name || `#${id}`}</span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-muted hover:text-fg"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      {!props.multi && selectedIds.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 border border-border bg-panelHi px-2 py-0.5 text-[11px] font-sans">
            {byId.get(selectedIds[0])?.display_name ||
              byId.get(selectedIds[0])?.name ||
              `#${selectedIds[0]}`}
            <button
              type="button"
              onClick={() => remove(selectedIds[0])}
              className="text-muted hover:text-fg"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        </div>
      ) : (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder={placeholder ?? 'Search agents…'}
            className="w-full border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:border-fg"
          />
          {open && candidates.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-border bg-bg shadow-lg">
              {candidates.slice(0, 30).map((a) => (
                <button
                  type="button"
                  key={a.Id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(a.Id)}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-panelHi"
                >
                  <span className="font-sans">{a.display_name || a.name}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-muted">
                    {a.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
