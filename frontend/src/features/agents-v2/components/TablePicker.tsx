import { useEffect, useMemo, useState } from 'react';
import { fetchNocoTables } from '../api';
import type { NocoTable } from '../types';

type CommonProps = { placeholder?: string };

type SingleProps = CommonProps & {
  multi?: false;
  value: string | null | undefined;
  onChange: (next: string | null) => void;
};
type MultiProps = CommonProps & {
  multi: true;
  value: string[] | null | undefined;
  onChange: (next: string[]) => void;
};

export type TablePickerProps = SingleProps | MultiProps;

export function TablePicker(props: TablePickerProps) {
  const [tables, setTables] = useState<NocoTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    setTables(null);
    fetchNocoTables()
      .then((res) => {
        if (!alive) return;
        setTables(res);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const selected: string[] = props.multi
    ? props.value ?? []
    : props.value
      ? [props.value]
      : [];

  const candidates = useMemo(() => {
    return (tables ?? [])
      .map((t) => t.name)
      .filter((n) => {
        if (props.multi && selected.includes(n)) return false;
        if (!query) return true;
        return n.toLowerCase().includes(query.toLowerCase());
      });
  }, [tables, query, selected, props.multi]);

  function pick(name: string) {
    if (props.multi) {
      props.onChange([...(props.value ?? []), name]);
    } else {
      props.onChange(name);
    }
    setQuery('');
    setOpen(false);
  }
  function remove(name: string) {
    if (props.multi) {
      props.onChange((props.value ?? []).filter((x) => x !== name));
    } else {
      props.onChange(null);
    }
  }

  if (error) {
    return (
      <div className="text-xs text-red-700 flex items-center gap-2">
        <span>Failed to load tables: {error}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline">
          Retry
        </button>
      </div>
    );
  }
  if (tables == null) return <div className="text-xs text-muted">Loading…</div>;
  if (tables.length === 0) return <div className="text-xs text-muted">No tables available.</div>;

  return (
    <div className="space-y-1">
      {props.multi && selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 border border-border bg-panelHi px-2 py-0.5 text-[11px] font-mono"
            >
              {n}
              <button
                type="button"
                onClick={() => remove(n)}
                className="text-muted hover:text-fg"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {!props.multi && selected.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 border border-border bg-panelHi px-2 py-0.5 text-[11px] font-mono">
            {selected[0]}
            <button
              type="button"
              onClick={() => remove(selected[0])}
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
            placeholder={props.placeholder ?? 'Search tables…'}
            className="w-full border border-border bg-bg px-3 py-2 text-sm font-mono focus:outline-none focus:border-fg"
          />
          {open && candidates.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-border bg-bg shadow-lg">
              {candidates.slice(0, 50).map((n) => (
                <button
                  type="button"
                  key={n}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(n)}
                  className="block w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-panelHi"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
