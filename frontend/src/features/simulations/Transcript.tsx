import { useEffect, useRef, useState } from 'react';
import type { Participant, SimStatus, Turn } from '../../api/simulations';
import { speakerColor } from './speakerColor';

interface Props {
  turns: Turn[];
  participants: Participant[];
  status: SimStatus;
}

export function Transcript({ turns, participants, status }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Detect user scroll-up to disable auto-scroll. Re-enable when they return
  // to the bottom.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom < 40);
  };

  useEffect(() => {
    if (!autoScroll) return;
    if (status !== 'running' && status !== 'queued') {
      // Still snap once on initial mount when complete, but don't fight the
      // user mid-read.
    }
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns.length, autoScroll, status]);

  const isLive = status === 'running' || status === 'queued';
  const nextSpeaker = participants.length
    ? participants[turns.length % participants.length]
    : null;

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto px-5 sm:px-8 py-6"
    >
      {turns.length === 0 && !isLive && (
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
          No transcript.
        </div>
      )}
      <ol className="space-y-4 max-w-3xl">
        {turns.map((t) => {
          const c = speakerColor(t.speaker);
          return (
            <li key={`${t.turn}-${t.speaker}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm border font-sans"
                  style={{ color: c.ink, background: c.wash, borderColor: c.border }}
                >
                  {t.speaker}
                </span>
                <span className="text-[10px] font-mono text-muted">
                  turn {String(t.turn).padStart(2, '0')}
                </span>
              </div>
              <div
                className="border rounded-[12px] px-4 py-3 text-sm leading-relaxed font-mono whitespace-pre-wrap"
                style={{ borderColor: c.border, background: c.wash + '88' }}
              >
                {t.text}
              </div>
            </li>
          );
        })}
        {isLive && nextSpeaker && (
          <li className="space-y-1.5 opacity-80">
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm border font-sans"
                style={{
                  color: speakerColor(nextSpeaker.name).ink,
                  background: speakerColor(nextSpeaker.name).wash,
                  borderColor: speakerColor(nextSpeaker.name).border,
                }}
              >
                {nextSpeaker.name}
              </span>
              <span className="text-[10px] font-mono text-muted">
                turn {String(turns.length + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="border border-dashed border-border rounded-[12px] px-4 py-3 text-xs text-muted font-sans inline-flex items-center gap-2">
              <TypingDots />
              <span className="uppercase tracking-[0.18em]">
                {nextSpeaker.name} is thinking
              </span>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="w-1 h-1 rounded-full bg-fg/60 animate-blink" />
      <span
        className="w-1 h-1 rounded-full bg-fg/60 animate-blink"
        style={{ animationDelay: '180ms' }}
      />
      <span
        className="w-1 h-1 rounded-full bg-fg/60 animate-blink"
        style={{ animationDelay: '360ms' }}
      />
    </span>
  );
}
