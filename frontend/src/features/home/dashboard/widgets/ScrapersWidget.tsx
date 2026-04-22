import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { listResearchPlans } from '../../../../api/enrichment/research';
import type { ResearchPlan } from '../../../../api/types/Enrichment';
import { formatRelative } from '../../../../lib/utils/formatRelative';

export function ScrapersWidget() {
  const [items, setItems] = useState<ResearchPlan[]>([]);

  useEffect(() => {
    listResearchPlans()
      .then((r) => setItems(r.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const counts = items.reduce<Record<string, number>>((acc, p) => {
    const status = p.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Scrapers / research</div>
        <Link
          to="/research"
          className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg"
        >
          Open
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-muted">No plans yet.</div>
      ) : (
        <>
          <div className="mb-2 text-[12px] text-muted">
            {Object.entries(counts)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')}
          </div>
          <ul className="space-y-1 text-[12px]">
            {items.slice(0, 3).map((p) => (
              <li key={p.Id} className="flex justify-between gap-2">
                <span className="truncate">{p.topic || `Plan #${p.Id}`}</span>
                <span className="shrink-0 text-muted">{formatRelative(p.created_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

