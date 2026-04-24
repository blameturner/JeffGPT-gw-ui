import { useMemo, useState } from 'react';
import type { Question } from '../../../api/home/types';
import { answerQuestion, dismissQuestion } from '../../../api/home/mutations';
import { useToast } from '../../../lib/toast/useToast';
import { QuestionCard } from './QuestionCard';
import { parseContextRef } from './questionContextRef';

interface Props {
  questions: Question[];
  onRefetch: () => void;
  onChatStream: (jobId: string) => void;
  registerScrollTarget?: (id: number, el: HTMLDivElement | null) => void;
  onOpenInsight?: (insightId: number) => void;
  onOpenLoops?: () => void;
}

// Non-dismissive answers are the ones the backend treats as actionable
// (e.g. anything other than "not now" / "skip" / "drop").
const DISMISSIVE_VALUES = new Set(['skip', 'drop', 'not_now', 'not-now', 'dismiss', 'no']);

function isDismissiveAnswer(value: string, label: string): boolean {
  const v = (value || '').toLowerCase();
  const l = (label || '').toLowerCase();
  if (DISMISSIVE_VALUES.has(v)) return true;
  return /^(skip|drop|not now|not really|dismiss|no)\b/.test(l);
}

export function QuestionsPanel({
  questions,
  onRefetch,
  onChatStream,
  registerScrollTarget,
  onOpenInsight,
  onOpenLoops,
}: Props) {
  const toast = useToast();
  const [optimisticallyHidden, setOptimisticallyHidden] = useState<Set<number>>(new Set());

  const visibleQuestions = useMemo(
    () => questions.filter((q) => !optimisticallyHidden.has(q.id)),
    [optimisticallyHidden, questions],
  );

  async function handleAnswer(q: Question, selectedOption: string, answerText: string) {
    setOptimisticallyHidden((s) => new Set(s).add(q.id));
    try {
      const { job_id } = await answerQuestion({
        id: q.id,
        selectedOption,
        answerText,
      });
      onChatStream(job_id);

      // If the user accepted an insight follow-up, nudge them toward the
      // insight card where the appended research will show up.
      const ctx = parseContextRef(q.context_ref);
      const actedOn = !isDismissiveAnswer(selectedOption, answerText);
      if (actedOn && ctx.kind === 'insight' && ctx.id != null) {
        toast.success('Research queued — will appear in the insight.');
      } else {
        toast.success('Answer sent');
      }
      onRefetch();
    } catch (err) {
      setOptimisticallyHidden((s) => {
        const next = new Set(s);
        next.delete(q.id);
        return next;
      });
      toast.error(`Answer failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleDismiss(q: Question) {
    setOptimisticallyHidden((s) => new Set(s).add(q.id));
    try {
      await dismissQuestion({ id: q.id });
      toast.info('Question dismissed');
      onRefetch();
    } catch (err) {
      setOptimisticallyHidden((s) => {
        const next = new Set(s);
        next.delete(q.id);
        return next;
      });
      toast.error(`Dismiss failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  const Header = (
    <div className="flex items-baseline gap-2 pb-1">
      <span className="text-[10px] uppercase tracking-[0.22em] font-sans text-muted">
        Queries Awaiting Attention
        {visibleQuestions.length > 0 && (
          <span className="ml-2 font-display not-italic tabular-nums">
            · {visibleQuestions.length}
          </span>
        )}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  if (visibleQuestions.length === 0) {
    return (
      <div>
        {Header}
        <div className="py-10 text-center">
          <p className="font-display italic text-lg text-muted">Quiet morning.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {Header}
      <div className="divide-y divide-border">
        {visibleQuestions.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            ref={(el) => registerScrollTarget?.(q.id, el)}
            onAnswer={handleAnswer}
            onDismiss={handleDismiss}
            onOpenInsight={onOpenInsight}
            onOpenLoops={onOpenLoops}
          />
        ))}
      </div>
    </div>
  );
}


