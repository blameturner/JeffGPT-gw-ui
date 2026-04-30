// Home dashboard — insights-first.
//
// The chat surface moved to the PA page (the personal assistant *is* the
// chat). Home is now a quick-glance overview: latest insights, the unified
// feed, pending questions, schedules + widgets. Briefing/answer streams
// that used to render inline now run in the background; the user opens the
// PA page to see them.

import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { FeedItem, HomeHealth, HomeOverview } from '../../../api/home/types';
import { GreetingStrip } from '../dashboard/GreetingStrip';
import { Feed } from '../dashboard/Feed';
import { QuestionsPanel } from '../dashboard/QuestionsPanel';
import { SchedulesPanel } from '../dashboard/SchedulesPanel';
import { WidgetRail } from '../dashboard/WidgetRail';
import { DigestModal } from '../dashboard/modals/DigestModal';
import { InsightModal } from '../dashboard/modals/InsightModal';
import { PAFactsModal } from '../dashboard/modals/PAFactsModal';
import { PAHeaderStrip } from '../dashboard/PAHeaderStrip';
import { OnMyMindPanel } from '../dashboard/OnMyMindPanel';
import { usePAStatus } from '../hooks/usePAStatus';
import { Eyebrow } from '../../../components/ui';
import { relTime } from '../../../lib/utils/relTime';

interface Props {
  overview: HomeOverview | null;
  health: HomeHealth | null;
  refetch: () => void;
}

// Streaming jobs fired from this page (briefing, question answers) used to
// render inline in HomeChat. With chat moved to /pa they run silently here;
// the assistant reply is persisted to the home conversation and appears
// next time the user opens PA.
const noopChatStream = (_jobId: string) => {};

export function DashboardTab({ overview, health, refetch }: Props) {
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [digestModal, setDigestModal] = useState<{ date?: string } | null>(null);
  const [insightModal, setInsightModal] = useState<number | null>(null);
  const [mindOpen, setMindOpen] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const { status: paStatus, refresh: refreshPA } = usePAStatus();

  function openFeedItem(item: FeedItem) {
    if (item.kind === 'digest') {
      setDigestModal({ date: item.ref.date as string | undefined });
      return;
    }
    if (item.kind === 'insight') {
      setInsightModal(item.id);
      return;
    }
    if (item.kind === 'question') {
      const el = questionRefs.current.get(item.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLButtonElement>(`button[data-question-option="${item.id}"]`)?.focus();
    }
  }

  const pending = overview?.pending_questions ?? [];
  const schedules = overview?.schedules ?? [];
  const recentInsights = overview?.recent_insights ?? [];
  const feedRefreshKey = [
    overview?.digest?.id ?? 0,
    overview?.recent_insights?.[0]?.id ?? 0,
    pending.length,
  ].join(':');

  const paEnabled = paStatus?.enabled ?? false;

  return (
    <div className="flex flex-col">
      <GreetingStrip
        health={health}
        onAfterMutate={refetch}
        onChatStream={noopChatStream}
      />

      {paEnabled && paStatus && (
        <PAHeaderStrip
          status={paStatus}
          onPinged={refreshPA}
          onOpenMind={() => setMindOpen(true)}
          onOpenFacts={() => setFactsOpen(true)}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 sm:gap-8 px-4 sm:px-8 py-5 sm:py-7">
        <main className="min-w-0 space-y-8">
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <Eyebrow>Latest insights</Eyebrow>
              <Link
                to="/pa"
                className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg"
              >
                Talk to PA →
              </Link>
            </div>
            {recentInsights.length === 0 ? (
              <div className="border border-dashed border-border rounded-md bg-panel/30 px-4 py-8 text-center text-xs text-muted">
                No insights yet. Run the producer or wait for the daily cron.
              </div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentInsights.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => setInsightModal(i.id)}
                      className="w-full text-left border border-border rounded-md bg-bg p-4 hover:border-fg transition-colors h-full"
                    >
                      <h3 className="font-display text-base tracking-tightest leading-tight mb-1.5">
                        {i.title || i.topic || 'Insight'}
                      </h3>
                      {i.summary && (
                        <p className="text-xs text-muted line-clamp-3 leading-relaxed">
                          {i.summary}
                        </p>
                      )}
                      {i.created_at && (
                        <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted">
                          {relTime(i.created_at)}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pending.length > 0 && (
            <div className="rounded-none bg-panel/60 border border-border px-4 sm:px-5 py-4">
              <QuestionsPanel
                questions={pending}
                onRefetch={refetch}
                onChatStream={noopChatStream}
                registerScrollTarget={(id, el) => {
                  if (el) questionRefs.current.set(id, el);
                  else questionRefs.current.delete(id);
                }}
                onOpenInsight={(insightId) => setInsightModal(insightId)}
                onOpenLoops={() => setMindOpen(true)}
              />
            </div>
          )}

          <Feed onOpen={openFeedItem} refreshKey={feedRefreshKey} />
        </main>

        <aside className="space-y-6 order-first xl:order-last">
          <SchedulesPanel schedules={schedules} />
          <WidgetRail overview={overview} refreshSignal={overview} />
        </aside>
      </div>

      {digestModal && <DigestModal date={digestModal.date} onClose={() => setDigestModal(null)} />}
      {insightModal != null && (
        <InsightModal id={insightModal} onClose={() => setInsightModal(null)} />
      )}
      {paEnabled && (
        <OnMyMindPanel
          open={mindOpen}
          onClose={() => setMindOpen(false)}
          onChanged={refreshPA}
        />
      )}
      {paEnabled && factsOpen && <PAFactsModal onClose={() => setFactsOpen(false)} />}
    </div>
  );
}
