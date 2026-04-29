import { useMemo } from 'react';
import type { ToolCatalogEntry } from '../types';

const CATEGORIES: Array<{ key: ToolCatalogEntry['category']; label: string }> = [
  { key: 'web', label: 'Web' },
  { key: 'storage', label: 'Storage' },
  { key: 'comms', label: 'Comms' },
  { key: 'code', label: 'Code' },
  { key: 'data', label: 'Data' },
  { key: 'custom', label: 'Custom' },
];

export function ToolPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: ToolCatalogEntry[];
  value: string[] | null | undefined;
  onChange: (next: string[]) => void;
}) {
  const selected = value ?? [];
  const grouped = useMemo(() => {
    const m = new Map<ToolCatalogEntry['category'], ToolCatalogEntry[]>();
    for (const t of catalog) {
      const arr = m.get(t.category) ?? [];
      arr.push(t);
      m.set(t.category, arr);
    }
    return m;
  }, [catalog]);

  function toggle(name: string) {
    if (selected.includes(name)) onChange(selected.filter((x) => x !== name));
    else onChange([...selected, name]);
  }

  if (catalog.length === 0) {
    return <div className="text-xs text-muted">No tools in catalog.</div>;
  }

  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => {
        const tools = grouped.get(cat.key) ?? [];
        if (tools.length === 0) return null;
        return (
          <div key={cat.key}>
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans mb-1">
              {cat.label}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {tools.map((t) => {
                const checked = selected.includes(t.name);
                return (
                  <label
                    key={t.name}
                    className="flex items-start gap-2 border border-border bg-bg px-2 py-1.5 text-xs hover:border-fg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(t.name)}
                      className="mt-0.5"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-mono">{t.name}</span>
                      <span className="block text-[11px] text-muted truncate">
                        {t.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
