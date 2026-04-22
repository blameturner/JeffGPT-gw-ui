import type { Question } from '../../../api/home/types';
import { answerQuestion, dismissQuestion } from '../../../api/home/mutations';
import { useToast } from '../../../lib/toast/useToast';
import { QuestionCard } from './QuestionCard';

interface Props {
  questions: Question[];
  onRefetch: () => void;
  onChatStream: (jobId: string) => void;
  registerScrollTarget?: (id: number, el: HTMLDivElement | null) => void;
}

export function QuestionsPanel({
  questions,
  onRefetch,
  onChatStream,
  registerScrollTarget,
}: Props) {
  const toast = useToast();

  async function handleAnswer(q: Question, selectedOption: string, answerText: string) {
    try {
      const { job_id } = await answerQuestion({
        id: q.id,
        selectedOption,
        answerText,
      });
      onChatStream(job_id);
      toast.success('Answer sent');
      onRefetch();
    } catch (err) {
      toast.error(`Answer failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleDismiss(q: Question) {
    try {
      await dismissQuestion({ id: q.id });
      toast.info('Question dismissed');
      onRefetch();
    } catch (err) {
      toast.error(`Dismiss failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted">
        No pending questions.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-muted">Pending questions</div>
      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          q={q}
          ref={(el) => registerScrollTarget?.(q.id, el)}
          onAnswer={handleAnswer}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

