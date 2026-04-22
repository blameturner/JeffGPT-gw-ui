import { useEffect, useState } from 'react';
import { listHomeFeed } from '../../../api/home/feed';
import { listInsights } from '../../../api/home/insights';
import { getHomeOverview } from '../../../api/home/overview';
import type { FeedItem, HomeOverview } from '../../../api/home/types';

function isToday(iso: string, now = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 font-display text-xl tracking-tightest">{value}</div>
    </div>
  );
}

export function TodaySection() {
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [insightsToday, setInsightsToday] = useState(0);

  useEffect(() => {
    Promise.all([getHomeOverview(), listHomeFeed({ limit: 100 }), listInsights({ limit: 50 })])
      .then(([ov, fd, ins]) => {
        setOverview(ov);
        setFeed(fd.items);
        setInsightsToday(ins.insights.filter((i) => isToday(i.created_at)).length);
      })
      .catch(() => {
        setOverview(null);
        setFeed([]);
        setInsightsToday(0);
      });
  }, []);

  const feedToday = feed.filter((f) => isToday(f.created_at));
  const byKind = feedToday.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="border-b border-border p-6">
      <h2 className="mb-3 font-display text-lg tracking-tightest">Today</h2>
      <div className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
        <Metric label="Digest clusters" value={overview?.digest?.cluster_count ?? '-'} />
        <Metric label="Digest sources" value={overview?.digest?.source_count ?? '-'} />
        <Metric label="Insights today" value={insightsToday} />
        <Metric label="Pending questions" value={overview?.pending_questions.length ?? 0} />
        <Metric label="Feed items today" value={feedToday.length} />
        <Metric label="...digests" value={byKind.digest ?? 0} />
        <Metric label="...runs" value={byKind.run ?? 0} />
        <Metric label="...questions" value={byKind.question ?? 0} />
      </div>
    </section>
  );
}

