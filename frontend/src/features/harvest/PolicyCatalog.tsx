import { useMemo, useState } from 'react';
import type { HarvestPolicy } from '../../api/harvest';
import { Empty, Eyebrow, TextInput } from '../../components/ui';

const TARGET_ORDER: string[] = ['knowledge', 'artifacts', 'knowledge_update', 'graph_node'];

const TARGET_ACCENT: Record<string, string> = {
  knowledge: 'before:bg-emerald-500',
  artifacts: 'before:bg-sky-500',
  knowledge_update: 'before:bg-amber-500',
  graph_node: 'before:bg-violet-500',
};

export function PolicyCatalog({
  policies,
  selected,
  onSelect,
}: {
  policies: HarvestPolicy[] | null;
  selected: HarvestPolicy | null;
  onSelect: (p: HarvestPolicy) => void;
}) {
  const [q, setQ] = useState('');

  const grouped = useMemo(() => {
    if (!policies) return [] as Array<[string, HarvestPolicy[]]>;
    const filtered = policies.filter(
      (p) => !q || p.name.toLowerCase().includes(q.toLowerCase()),
    );
    const map = new Map<string, HarvestPolicy[]>();
    for (const p of filtered) {
      const t = p.persist_target ?? 'other';
      const cur = map.get(t) ?? [];
      cur.push(p);
      map.set(t, cur);
    }
    const ordered: Array<[string, HarvestPolicy[]]> = [];
    for (const t of TARGET_ORDER) {
      const v = map.get(t);
      if (v) ordered.push([t, v]);
    }
    for (const [t, v] of map) if (!TARGET_ORDER.includes(t)) ordered.push([t, v]);
    return ordered;
  }, [policies, q]);

  return (
    <aside className="flex flex-col min-h-0 overflow-hidden bg-panel/40">
      <div className="shrink-0 p-3 border-b border-border">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search policies"
          density="compact"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {policies == null ? (
          <div className="px-3 py-3 text-xs text-muted">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="px-3 py-3">
            <Empty compact title={q ? 'no matches' : 'no policies'} />
          </div>
        ) : (
          <ul className="space-y-4 py-2">
            {grouped.map(([target, items]) => (
              <li key={target}>
                <div className="px-3 mb-1 flex items-center gap-2">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      TARGET_ACCENT[target]?.replace('before:', '') ?? 'bg-border'
                    }`}
                    aria-hidden
                  />
                  <Eyebrow>{target}</Eyebrow>
                  <span className="ml-auto text-[10px] font-mono text-muted">
                    {items.length}
                  </span>
                </div>
                <ul>
                  {items.map((p) => {
                    const active = selected?.name === p.name;
                    return (
                      <li key={p.name}>
                        <button
                          onClick={() => onSelect(p)}
                          className={[
                            'group w-full text-left pl-4 pr-3 py-1.5 text-xs flex items-center gap-2 transition-colors relative',
                            active
                              ? 'bg-bg text-fg shadow-[inset_2px_0_0_0_var(--tw-shadow-color)] shadow-fg'
                              : 'text-fg/85 hover:bg-panelHi',
                          ].join(' ')}
                        >
                          <span className="font-mono truncate flex-1">{p.name}</span>
                          {p.walk_enabled && (
                            <span
                              title="walk enabled"
                              className="text-[9px] uppercase tracking-[0.16em] text-muted shrink-0 px-1 border border-border rounded-sm"
                            >
                              walk
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
