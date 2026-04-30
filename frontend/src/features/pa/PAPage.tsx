import { useEffect, useState } from 'react';
import {
  paPageApi,
  type AnchoredAsk,
  type PAFeedItem,
  type PATopic,
} from '../../api/pa';
import {
  Btn,
  Drawer,
  Empty,
  Eyebrow,
  PageHeader,
  StatusPill,
  TabRow,
  type TabDef,
} from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

type Tab = 'asks' | 'topics';
const TABS: ReadonlyArray<TabDef<Tab>> = [
  { id: 'asks', label: 'Anchored asks' },
  { id: 'topics', label: 'Topics' },
];

export function PAPage() {
  const [tab, setTab] = useState<Tab>('asks');
  const [feed, setFeed] = useState<PAFeedItem[] | null>(null);

  useEffect(() => {
    paPageApi.feed(50).then((r) => setFeed(r.items)).catch(() => setFeed([]));
  }, []);

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Personal agent"
        title="PA"
        right={<TabRow tabs={TABS} active={tab} onChange={setTab} size="sm" />}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'asks' ? <AsksTab /> : <TopicsTab />}
      </div>

      <FeedStrip items={feed} />
    </div>
  );
}

function AsksTab() {
  const [asks, setAsks] = useState<AnchoredAsk[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    paPageApi.anchoredAsks('open', 100).then((r) => setAsks(r.asks)).catch(() => setAsks([]));
  useEffect(() => {
    void load();
  }, []);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-5">
      {asks == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : asks.length === 0 ? (
        <Empty title="No anchored asks" hint="They'll appear here once the PA opens follow-ups." />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted border-b border-border">
                <th className="text-left py-2">title</th>
                <th className="text-left py-2 w-28">status</th>
                <th className="text-right py-2 w-20">age</th>
                <th className="text-right py-2 w-32">last nudge</th>
                <th className="text-right py-2 w-60">actions</th>
              </tr>
            </thead>
            <tbody>
              {asks.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-panel/60">
                  <td className="py-2 pr-3 text-fg">{a.title}</td>
                  <td className="py-2">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="py-2 text-right font-mono text-xs text-muted">
                    {fmtAge(a.age_seconds)}
                  </td>
                  <td className="py-2 text-right font-mono text-xs text-muted">
                    {a.last_nudge_at ? relTime(a.last_nudge_at) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Btn
                        size="sm"
                        disabled={busy === a.id}
                        onClick={() => void act(a.id, () => paPageApi.nudgeAsk(a.id))}
                      >
                        Nudge
                      </Btn>
                      <Btn
                        size="sm"
                        disabled={busy === a.id}
                        onClick={() => void act(a.id, () => paPageApi.snoozeAsk(a.id, 24))}
                      >
                        Snooze
                      </Btn>
                      <Btn
                        size="sm"
                        variant="danger"
                        disabled={busy === a.id}
                        onClick={() => void act(a.id, () => paPageApi.closeAsk(a.id))}
                      >
                        Close
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtAge(s: number): string {
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function TopicsTab() {
  const [topics, setTopics] = useState<PATopic[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<PATopic | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    paPageApi.topics(60).then((r) => setTopics(r.topics)).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (!activeId) {
      setActive(null);
      return;
    }
    setDrawerLoading(true);
    paPageApi
      .topic(activeId)
      .then(setActive)
      .finally(() => setDrawerLoading(false));
  }, [activeId]);

  return (
    <div className="px-5 sm:px-8 py-5">
      {topics == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : topics.length === 0 ? (
        <Empty title="No warm topics" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className="text-left group border border-border rounded-md bg-bg p-4 hover:border-fg hover:shadow-card transition-all"
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h3 className="font-display text-base tracking-tightest leading-tight truncate flex-1">
                  {t.title}
                </h3>
                {t.warmth != null && (
                  <span
                    className="shrink-0 font-mono text-[10px] text-muted border border-border rounded-sm px-1.5 py-0.5"
                    title="warmth"
                  >
                    {t.warmth.toFixed(2)}
                  </span>
                )}
              </div>
              {t.warmth != null && (
                <div className="h-0.5 bg-panel rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-fg/80"
                    style={{ width: `${Math.min(100, t.warmth * 100)}%` }}
                  />
                </div>
              )}
              {t.brief && (
                <p className="text-xs text-muted line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {t.brief}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted">
                {t.last_active && <span>{relTime(t.last_active)}</span>}
                {t.source_count != null && <span>{t.source_count} src</span>}
                {t.muted && <span className="text-fg/70">muted</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Drawer
        open={!!activeId && !!active}
        onClose={() => setActiveId(null)}
        eyebrow="Topic"
        title={active?.title}
        meta={active?.warmth != null ? `warmth ${active.warmth.toFixed(2)}` : undefined}
        actions={
          active && (
            <>
              <Btn
                variant="primary"
                onClick={() => {
                  if (active) void paPageApi.researchTopic(active.id);
                }}
              >
                Research now
              </Btn>
              <Btn
                disabled={!!active?.muted}
                onClick={async () => {
                  if (!active) return;
                  await paPageApi.muteTopic(active.id);
                  setActive({ ...active, muted: true });
                }}
              >
                {active?.muted ? 'Muted' : 'Mute'}
              </Btn>
            </>
          )
        }
      >
        {drawerLoading && <div className="text-xs text-muted">Loading…</div>}
        {active?.brief && (
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-fg/90">{active.brief}</p>
        )}
        {active?.sources && active.sources.length > 0 && (
          <div className="mt-5">
            <Eyebrow className="mb-1.5">Sources</Eyebrow>
            <ul className="space-y-1.5 text-xs">
              {active.sources.map((s) => (
                <li key={s.id} className="border-l-2 border-border pl-2">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:no-underline"
                    >
                      {s.title || s.url}
                    </a>
                  ) : (
                    s.title || s.id
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {active?.engagement != null && (
          <div className="mt-5 text-xs flex items-baseline justify-between border-t border-border pt-3">
            <Eyebrow>engagement</Eyebrow>
            <span className="font-mono">{active.engagement.toFixed(2)}</span>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function FeedStrip({ items }: { items: PAFeedItem[] | null }) {
  return (
    <div className="shrink-0 border-t border-border bg-panel/50">
      <div className="px-5 sm:px-8 py-2.5 flex items-center gap-3 overflow-x-auto no-scrollbar">
        <Eyebrow className="shrink-0">Daily feed</Eyebrow>
        {items == null ? (
          <div className="text-xs text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">no data</div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="shrink-0 max-w-xs border border-border rounded-sm px-2.5 py-1.5 bg-bg hover:border-fg/40 transition-colors"
              title={it.summary}
            >
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-muted">
                <span>{it.kind}</span>
                <span aria-hidden>·</span>
                <span>{relTime(it.created_at)}</span>
              </div>
              <div className="text-xs truncate text-fg/90">{it.title}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
