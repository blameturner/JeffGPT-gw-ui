import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PALoop, PATopic } from '../../../api/home/types';
import { listLoops, resolveLoop, dropLoop } from '../../../api/home/loops';
import { listTopics } from '../../../api/home/topics';
import { formatRelative } from '../../../lib/utils/formatRelative';
import { useToast } from '../../../lib/toast/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged: () => void; // refresh PA counters after mutations
}

type Tab = 'loops' | 'topics';

export function OnMyMindPanel({ open, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>('loops');
  const [loops, setLoops] = useState<PALoop[]>([]);
  const [topics, setTopics] = useState<PATopic[]>([]);
  const [loopsLoaded, setLoopsLoaded] = useState(false);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const toast = useToast();

  const loadLoops = useCallback(async () => {
    try {
      const res = await listLoops({ status: 'open' });
      setLoops(res.loops);
    } catch {
      /* swallow; keep last */
    } finally {
      setLoopsLoaded(true);
    }
  }, []);

  const loadTopics = useCallback(async () => {
    try {
      const res = await listTopics();
      setTopics(res.topics);
    } catch {
      /* swallow; keep last */
    } finally {
      setTopicsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (tab === 'loops' && !loopsLoaded) void loadLoops();
    if (tab === 'topics' && !topicsLoaded) void loadTopics();
  }, [open, tab, loopsLoaded, topicsLoaded, loadLoops, loadTopics]);

  // Esc to close; body scroll lock
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const sortedLoops = useMemo(() => {
    const copy = [...loops];
    copy.sort((a, b) => {
      // nudged first (any nudge_count > 0 or status === 'nudged')
      const aN = a.status === 'nudged' || (a.nudge_count ?? 0) > 0 ? 1 : 0;
      const bN = b.status === 'nudged' || (b.nudge_count ?? 0) > 0 ? 1 : 0;
      if (aN !== bN) return bN - aN;
      return new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime();
    });
    return copy;
  }, [loops]);

  async function handleResolve(loop: PALoop) {
    const note = window.prompt(`Mark done — "${loop.text.slice(0, 80)}"\n\nOptional note:`) ?? '';
    if (note === null) return;
    try {
      await resolveLoop(loop.Id, { note });
      setLoops((ls) => ls.filter((l) => l.Id !== loop.Id));
      toast.success('Loop closed.');
      onChanged();
    } catch (err) {
      toast.error(`Couldn't resolve: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleDrop(loop: PALoop) {
    const reason = window.prompt(`Drop — "${loop.text.slice(0, 80)}"\n\nOptional reason:`) ?? '';
    if (reason === null) return;
    try {
      await dropLoop(loop.Id, { reason });
      setLoops((ls) => ls.filter((l) => l.Id !== loop.Id));
      toast.info('Loop dropped.');
      onChanged();
    } catch (err) {
      toast.error(`Couldn't drop: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* scrim */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* drawer: full-width on mobile, right-anchored panel on sm+ */}
      <aside
        className="relative ml-auto h-full w-full sm:w-[460px] max-w-full bg-bg border-l border-border flex flex-col shadow-2xl"
        role="dialog"
        aria-label="On my mind"
      >
        <header className="shrink-0 border-b border-border px-4 sm:px-5 py-3 flex items-center justify-between">
          <h2 className="font-display italic text-lg text-fg">On my mind</h2>
          <button
            onClick={onClose}
            className="text-[12px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg px-2 py-1 -mr-2"
            aria-label="Close"
          >
            Close
          </button>
        </header>

        <nav className="shrink-0 border-b border-border px-3 sm:px-4 flex gap-0.5">
          {(['loops', 'topics'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                'px-3 sm:px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] font-sans border-b-2 -mb-px transition-colors',
                tab === id
                  ? 'border-fg text-fg'
                  : 'border-transparent text-muted hover:text-fg',
              ].join(' ')}
            >
              {id === 'loops' ? `Open loops${loops.length ? ` · ${loops.length}` : ''}` : 'Warm topics'}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'loops' && (
            <LoopsList
              loops={sortedLoops}
              loaded={loopsLoaded}
              onResolve={handleResolve}
              onDrop={handleDrop}
            />
          )}
          {tab === 'topics' && <TopicsList topics={topics} loaded={topicsLoaded} />}
        </div>
      </aside>
    </div>
  );
}

function LoopsList({
  loops,
  loaded,
  onResolve,
  onDrop,
}: {
  loops: PALoop[];
  loaded: boolean;
  onResolve: (l: PALoop) => void;
  onDrop: (l: PALoop) => void;
}) {
  if (!loaded) {
    return <div className="px-4 sm:px-5 py-6 text-[12px] italic font-display text-muted">Loading…</div>;
  }
  if (loops.length === 0) {
    return (
      <div className="px-4 sm:px-5 py-10 text-center">
        <p className="font-display italic text-muted">
          Nothing here yet — chat a bit and the PA will start picking things up.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {loops.map((l) => (
        <LoopRow key={l.Id} loop={l} onResolve={onResolve} onDrop={onDrop} />
      ))}
    </ul>
  );
}

function LoopRow({
  loop,
  onResolve,
  onDrop,
}: {
  loop: PALoop;
  onResolve: (l: PALoop) => void;
  onDrop: (l: PALoop) => void;
}) {
  const nudged = loop.status === 'nudged' || (loop.nudge_count ?? 0) > 0;
  const truncated = loop.text.length > 120 ? loop.text.slice(0, 118) + '…' : loop.text;

  return (
    <li className="group px-4 sm:px-5 py-3 hover:bg-panel/60 transition-colors">
      <div className="flex items-start gap-3">
        <span
          className={[
            'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
            nudged ? 'bg-amber-500' : 'bg-fg',
          ].join(' ')}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[14px] text-fg leading-snug"
            title={loop.text.length > 120 ? loop.text : undefined}
          >
            {truncated}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
            <span className="border border-border px-1.5 py-0.5">{loop.intent || 'loop'}</span>
            {loop.when_hint && <span>· {loop.when_hint}</span>}
            {nudged && <span className="text-amber-600">· nudged ×{loop.nudge_count}</span>}
            <span>· {formatRelative(loop.CreatedAt)}</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={() => onResolve(loop)}
              className="border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans hover:border-fg"
            >
              Mark done
            </button>
            <button
              onClick={() => onDrop(loop)}
              className="border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:border-fg hover:text-fg"
            >
              Drop
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function TopicsList({ topics, loaded }: { topics: PATopic[]; loaded: boolean }) {
  if (!loaded) {
    return <div className="px-4 sm:px-5 py-6 text-[12px] italic font-display text-muted">Loading…</div>;
  }
  if (topics.length === 0) {
    return (
      <div className="px-4 sm:px-5 py-10 text-center">
        <p className="font-display italic text-muted">
          Nothing here yet — chat a bit and the PA will start picking things up.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {topics.map((t) => (
        <TopicRow key={t.Id} topic={t} />
      ))}
    </ul>
  );
}

function TopicRow({ topic }: { topic: PATopic }) {
  const [open, setOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const warmthPct = Math.max(0, Math.min(100, Math.round((topic.warmth ?? 0) * 100)));

  const sourceItems = useMemo(
    () =>
      (topic.sources ?? []).map((s, i) => {
        if (typeof s === 'string') return { key: `${s}-${i}`, url: s, title: s };
        return { key: `${s.url}-${i}`, url: s.url, title: s.title || s.url };
      }),
    [topic.sources],
  );

  return (
    <li className="px-4 sm:px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-start gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] text-fg truncate">{topic.entity_or_phrase}</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-[2px] flex-1 max-w-[140px] bg-border">
              <div
                className="h-full bg-fg"
                style={{ width: `${warmthPct}%` }}
                aria-label={`warmth ${warmthPct}%`}
              />
            </div>
            <span className="text-[10px] font-sans tabular-nums text-muted">{warmthPct}%</span>
            {topic.kind && (
              <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
                · {topic.kind}
              </span>
            )}
          </div>
        </div>
        <span className="text-muted font-display not-italic text-sm shrink-0" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {topic.background_brief && (
            <p className="text-[12.5px] text-fg/90 leading-relaxed">{topic.background_brief}</p>
          )}
          {topic.last_touched_at && (
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
              Last touched · {formatRelative(topic.last_touched_at)}
            </div>
          )}
          {sourceItems.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setSourcesOpen((v) => !v)}
                className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg font-sans"
              >
                {sourcesOpen ? 'Hide' : 'Show'} sources ({sourceItems.length})
              </button>
              {sourcesOpen && (
                <ul className="mt-1 space-y-0.5 text-[12px]">
                  {sourceItems.map((s) => (
                    <li key={s.key}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 decoration-border hover:decoration-fg break-all"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
