import { forwardRef, useState } from 'react';
import type { Question } from '../../../api/home/types';
import { formatRelative } from '../../../lib/utils/formatRelative';
import { parseContextRef } from './questionContextRef';

interface Props {
  q: Question;
  onAnswer: (q: Question, selectedOption: string, answerText: string) => void;
  onDismiss: (q: Question) => void;
  onOpenInsight?: (insightId: number) => void;
  onOpenLoops?: () => void;
}

export const QuestionCard = forwardRef<HTMLDivElement, Props>(function QuestionCard(
  { q, onAnswer, onDismiss, onOpenInsight, onOpenLoops },
  ref,
) {
  const [freeText, setFreeText] = useState('');
  const ctx = parseContextRef(q.context_ref);

  function handleBadgeClick() {
    if (!ctx.deepLink || ctx.id == null) return;
    if (ctx.kind === 'insight' && onOpenInsight) onOpenInsight(ctx.id);
    else if ((ctx.kind === 'loop' || ctx.kind === 'stale-loop') && onOpenLoops) onOpenLoops();
  }

  const badgeTone =
    ctx.kind === 'stale-loop'
      ? 'border-amber-600/60 text-amber-700'
      : ctx.kind === 'insight'
        ? 'border-fg text-fg'
        : 'border-border text-muted';

  return (
    <div ref={ref} className="relative pl-4 sm:pl-5 py-4 pr-2">
      <span className="absolute left-0 top-4 bottom-4 w-[2px] bg-fg" aria-hidden />

      {ctx.label && (
        <div className="mb-1.5">
          {ctx.deepLink ? (
            <button
              type="button"
              onClick={handleBadgeClick}
              className={[
                'inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans hover:bg-panel/70 transition-colors',
                badgeTone,
              ].join(' ')}
              title={
                ctx.kind === 'insight'
                  ? 'Open the insight'
                  : 'Show open loops'
              }
            >
              <span aria-hidden className="font-display not-italic">{ctx.glyph}</span>
              <span>{ctx.label}</span>
              <span aria-hidden className="opacity-60">›</span>
            </button>
          ) : (
            <span
              className={[
                'inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans',
                badgeTone,
              ].join(' ')}
            >
              <span aria-hidden className="font-display not-italic">{ctx.glyph}</span>
              <span>{ctx.label}</span>
            </span>
          )}
        </div>
      )}

      <p className="font-display italic text-[19px] sm:text-[20px] leading-snug text-fg">
        {q.question_text}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {q.suggested_options.map((opt, i) => {
          const letter = String.fromCharCode(97 + i);
          return (
            <button
              key={opt.value}
              data-question-option={q.id}
              className="group inline-flex items-baseline gap-1.5 border border-border px-2.5 py-1 text-[12px] font-sans hover:border-fg hover:bg-panel/60 transition-colors"
              onClick={() => onAnswer(q, opt.value, opt.label)}
            >
              <span className="font-display italic text-muted group-hover:text-fg text-[11px]">
                {letter}.
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Or type a custom answer…"
          className="flex-1 bg-transparent border-b border-border px-0 py-1 text-[13px] font-sans outline-none focus:border-fg placeholder:text-muted/60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && freeText.trim()) onAnswer(q, '', freeText.trim());
          }}
        />
        <button
          className="text-[10px] uppercase tracking-[0.18em] font-sans text-muted hover:text-fg"
          onClick={() => onDismiss(q)}
        >
          Dismiss
        </button>
      </div>

      <div className="mt-2 text-[11px] text-muted font-sans">
        <span className="italic font-display">filed</span>{' '}
        <span>{formatRelative(q.created_at)}</span>
      </div>
    </div>
  );
});
