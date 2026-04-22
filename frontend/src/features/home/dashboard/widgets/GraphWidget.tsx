import type { GraphWidgetData, WidgetEnvelope } from '../../../../api/home/types';
import { PlaceholderWidget } from './PlaceholderWidget';

export function GraphWidget({ env }: { env: WidgetEnvelope<GraphWidgetData> | undefined }) {
  if (!env?.enabled || !env.data) {
    return <PlaceholderWidget title="Graph" message={env?.message || 'Not configured'} />;
  }

  const { top_entities, sparse_concepts, recent_edges } = env.data;

  return (
    <div className="space-y-3 border border-border p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Graph</div>
      {top_entities.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted">Top entities</div>
          <ul className="space-y-0.5 text-[12px]">
            {top_entities.slice(0, 5).map((e) => (
              <li key={`${e.type}:${e.name}`} className="flex justify-between">
                <span className="truncate">{e.name}</span>
                <span className="text-muted">{e.degree}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sparse_concepts.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted">Sparse concepts</div>
          <div className="text-[12px] text-muted">{sparse_concepts.slice(0, 6).join(' · ')}</div>
        </div>
      )}
      {recent_edges.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted">Recent edges</div>
          <ul className="space-y-0.5 text-[12px]">
            {recent_edges.slice(0, 4).map((e, i) => (
              <li key={`${e.from}:${e.relationship}:${e.to}:${i}`} className="truncate">
                {e.from} <span className="text-muted">→ {e.relationship} →</span> {e.to}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

