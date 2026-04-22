import { forwardRef, useState } from 'react';
import type { Question } from '../../../api/home/types';

interface Props {
  q: Question;
  onAnswer: (q: Question, selectedOption: string, answerText: string) => void;
  onDismiss: (q: Question) => void;
}

export const QuestionCard = forwardRef<HTMLDivElement, Props>(function QuestionCard(
  { q, onAnswer, onDismiss },
  ref,
) {
  const [freeText, setFreeText] = useState('');

  return (
    <div ref={ref} className="border border-border p-4">
      <div className="text-sm text-fg">{q.question_text}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {q.suggested_options.map((opt) => (
          <button
            key={opt.value}
            data-question-option={q.id}
            className="border border-border px-3 py-1 text-[12px] hover:border-fg"
            onClick={() => onAnswer(q, opt.value, opt.label)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Or type a custom answer..."
          className="flex-1 border border-border bg-transparent px-2 py-1 text-[12px] outline-none focus:border-fg"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && freeText.trim()) onAnswer(q, '', freeText.trim());
          }}
        />
        <button
          className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
          onClick={() => onDismiss(q)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
});

