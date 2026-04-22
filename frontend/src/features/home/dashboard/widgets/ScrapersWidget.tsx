import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { listResearchPlans } from '../../../../api/enrichment/research';
import { listQueueJobs } from '../../../../api/queue/listQueueJobs';
import type { ResearchPlan } from '../../../../api/types/Enrichment';
import { formatRelative } from '../../../../lib/utils/formatRelative';

interface ScraperRow {
  id: string;
  title: string;
  status: string;
}

export function ScrapersWidget({ refreshSignal }: { refreshSignal?: unknown }) {
  const [items, setItems] = useState<ResearchPlan[]>([]);
  const [fallbackItems, setFallbackItems] = useState<ScraperRow[]>([]);

  useEffect(() => {
    listResearchPlans()
      .then(async (r) => {
        const plans = r.items ?? [];
        setItems(plans);
        if (plans.length > 0) {
          setFallbackItems([]);
          return;
        }
        const jobs = await listQueueJobs({ limit: 5 });
        const scraperRows = (jobs.jobs ?? []).map((j) => ({
          id: j.job_id,
          title: j.type || `Job #${j.job_id}`,
          status: j.status || 'unknown',
        }));
        setFallbackItems(scraperRows);
      })
      .catch(() => {
        setItems([]);
        setFallbackItems([]);
      });
  }, [refreshSignal]);

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
      {items.length === 0 && fallbackItems.length === 0 ? (
        <div className="text-[12px] text-muted">No plans yet.</div>
      ) : (
        <>
          {items.length > 0 && (
            <div className="mb-2 text-[12px] text-muted">
              {Object.entries(counts)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </div>
          )}
          <ul className="space-y-1 text-[12px]">
            {items.length > 0
              ? items.slice(0, 3).map((p) => (
                  <li key={p.Id} className="flex justify-between gap-2">
                    <span className="truncate">{p.topic || `Plan #${p.Id}`}</span>
                    <span className="shrink-0 text-muted">{formatRelative(p.created_at)}</span>
                  </li>
                ))
              : fallbackItems.slice(0, 3).map((j) => (
                  <li key={j.id} className="flex justify-between gap-2">
                    <span className="truncate">{j.title}</span>
                    <span className="shrink-0 text-muted">{j.status}</span>
                  </li>
                ))}
          </ul>
        </>
      )}
    </div>
  );
}



