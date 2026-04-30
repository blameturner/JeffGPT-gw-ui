// PA page — Home Chat is the personal assistant.
//
// Layout: chat fills the page; PA-specific affordances (open asks, warm
// topics, on-my-mind drawer, facts modal) sit in a compact right rail and
// header strip. The Home page now focuses on insights / feed; this page is
// where the user actually talks to the PA.

import { useEffect, useRef, useState } from 'react';
import { paPageApi, type AnchoredAsk, type PATopic } from '../../api/pa';
import { Btn, Drawer, Empty, Eyebrow, PageHeader, StatusPill } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';
import { useOverview } from '../home/hooks/useOverview';
import { usePAStatus } from '../home/hooks/usePAStatus';
import { HomeChat, type HomeChatHandle } from '../home/dashboard/HomeChat';
import { PAHeaderStrip } from '../home/dashboard/PAHeaderStrip';
import { OnMyMindPanel } from '../home/dashboard/OnMyMindPanel';
import { PAFactsModal } from '../home/dashboard/modals/PAFactsModal';

export function PAPage() {
  const { overview } = useOverview();
  const { status: paStatus, refresh: refreshPA } = usePAStatus();
  const chatRef = useRef<HomeChatHandle>(null);
  const [mindOpen, setMindOpen] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const [topicDrawerId, setTopicDrawerId] = useState<string | null>(null);

  const paEnabled = paStatus?.enabled ?? false;

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Personal assistant"
        title="PA"
        right={
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={() => setFactsOpen(true)}>
              Facts
            </Btn>
            <Btn size="sm" onClick={() => setMindOpen(true)}>
              On my mind
            </Btn>
          </div>
        }
      />

      {paEnabled && paStatus && (
        <PAHeaderStrip
          status={paStatus}
          onPinged={() => {
            void refreshPA();
            chatRef.current?.refresh();
          }}
          onOpenMind={() => setMindOpen(true)}
          onOpenFacts={() => setFactsOpen(true)}
        />
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6 overflow-hidden">
        <section className="h-[70vh] min-h-[420px] lg:h-auto lg:min-h-0">
          <HomeChat ref={chatRef} conversationId={overview?.home_conversation?.id ?? null} />
        </section>

        <aside className="space-y-6 min-h-0 overflow-y-auto pr-1">
          <AsksPanel
            onAct={() => {
              void refreshPA();
            }}
          />
          <TopicsPanel onOpen={(id) => setTopicDrawerId(id)} />
        </aside>
      </div>

      <TopicDrawer
        id={topicDrawerId}
        onClose={() => setTopicDrawerId(null)}
      />
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

function AsksPanel({ onAct }: { onAct: () => void }) {
  const [asks, setAsks] = useState<AnchoredAsk[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    paPageApi
      .anchoredAsks('open', 25)
      .then((r) => setAsks(r.asks))
      .catch(() => setAsks([]));

  useEffect(() => {
    void load();
  }, []);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await load();
      onAct();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <Eyebrow>Anchored asks</Eyebrow>
        {asks && asks.length > 0 && (
          <span className="font-mono text-[10px] text-muted">{asks.length}</span>
        )}
      </div>
      {asks == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : asks.length === 0 ? (
        <Empty compact title="nothing open" hint="The PA will surface follow-ups here." />
      ) : (
        <ul className="space-y-2">
          {asks.slice(0, 8).map((a) => (
            <li
              key={a.id}
              className="border border-border rounded-md bg-bg p-3 space-y-1.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs leading-snug text-fg/90 line-clamp-2 flex-1">{a.title}</p>
                <StatusPill status={a.status} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] border border-border rounded-sm text-muted hover:text-fg hover:border-fg disabled:opacity-50"
                  disabled={busy === a.id}
                  onClick={() => void act(a.id, () => paPageApi.nudgeAsk(a.id))}
                >
                  Nudge
                </button>
                <button
                  className="px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] border border-border rounded-sm text-muted hover:text-fg hover:border-fg disabled:opacity-50"
                  disabled={busy === a.id}
                  onClick={() => void act(a.id, () => paPageApi.snoozeAsk(a.id, 24))}
                >
                  Snooze
                </button>
                <button
                  className="px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] border border-border rounded-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  disabled={busy === a.id}
                  onClick={() => void act(a.id, () => paPageApi.closeAsk(a.id))}
                >
                  Close
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopicsPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [topics, setTopics] = useState<PATopic[] | null>(null);

  useEffect(() => {
    paPageApi
      .topics(20)
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]));
  }, []);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <Eyebrow>Warm topics</Eyebrow>
        {topics && topics.length > 0 && (
          <span className="font-mono text-[10px] text-muted">{topics.length}</span>
        )}
      </div>
      {topics == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : topics.length === 0 ? (
        <Empty compact title="no warm topics" />
      ) : (
        <ul className="space-y-1.5">
          {topics.slice(0, 12).map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onOpen(t.id)}
                className="w-full text-left border border-border rounded-md bg-bg px-3 py-2 hover:border-fg transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-fg/90 truncate flex-1">{t.title}</span>
                  {t.warmth != null && (
                    <span className="font-mono text-[10px] text-muted shrink-0">
                      {t.warmth.toFixed(2)}
                    </span>
                  )}
                </div>
                {t.last_active && (
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    {relTime(t.last_active)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopicDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [topic, setTopic] = useState<PATopic | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setTopic(null);
      return;
    }
    setLoading(true);
    paPageApi
      .topic(id)
      .then(setTopic)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Drawer
      open={!!id && !!topic}
      onClose={onClose}
      eyebrow="Topic"
      title={topic?.title}
      meta={topic?.warmth != null ? `warmth ${topic.warmth.toFixed(2)}` : undefined}
      actions={
        topic && (
          <>
            <Btn variant="primary" onClick={() => void paPageApi.researchTopic(topic.id)}>
              Research now
            </Btn>
            <Btn
              disabled={!!topic?.muted}
              onClick={async () => {
                await paPageApi.muteTopic(topic.id);
                setTopic({ ...topic, muted: true });
              }}
            >
              {topic.muted ? 'Muted' : 'Mute'}
            </Btn>
          </>
        )
      }
    >
      {loading && <div className="text-xs text-muted">Loading…</div>}
      {topic?.brief && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-fg/90">{topic.brief}</p>
      )}
      {topic?.sources && topic.sources.length > 0 && (
        <div className="mt-5">
          <Eyebrow className="mb-1.5">Sources</Eyebrow>
          <ul className="space-y-1.5 text-xs">
            {topic.sources.map((s) => (
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
    </Drawer>
  );
}
