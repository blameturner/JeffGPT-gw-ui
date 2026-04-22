// frontend/src/features/home/dashboard/GreetingStrip.tsx
import { useState } from 'react';
import type { HomeHealth } from '../../../api/home/types';
import { formatSecondsSinceChat } from '../../../lib/utils/formatRelative';
import { useToast } from '../../../lib/toast/useToast';
import { runDigest, produceInsight, runBriefing } from '../../../api/home/mutations';
import { ProduceInsightPopover } from './ProduceInsightPopover';

interface Props {
  health: HomeHealth | null;
  onAfterMutate: () => void; // refetch overview
  onChatStream: (jobId: string) => void; // hand briefing stream to HomeChat
}

export function GreetingStrip({ health, onAfterMutate, onChatStream }: Props) {
  const toast = useToast();
  const [producing, setProducing] = useState(false);
  const [showInsight, setShowInsight] = useState(false);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleDigest() {
    try {
      await runDigest();
      toast.success("Digest queued — it'll appear in a minute");
      // Poll overview for up to 2 minutes
      const start = Date.now();
      const iv = window.setInterval(() => {
        onAfterMutate();
        if (Date.now() - start > 2 * 60_000) window.clearInterval(iv);
      }, 10_000);
    } catch (err) {
      toast.error(`Digest failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleInsight(topicHint: string | null) {
    setShowInsight(false);
    setProducing(true);
    try {
      await produceInsight({ topicHint });
      toast.success('Insight queued — ~60s');
      window.setTimeout(onAfterMutate, 60_000);
    } catch (err) {
      toast.error(`Insight failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setProducing(false);
    }
  }

  async function handleBrief() {
    try {
      const { job_id } = await runBriefing();
      onChatStream(job_id);
      toast.info('Briefing streaming into chat…');
    } catch (err) {
      toast.error(`Briefing failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border px-8 py-4">
      <div>
        <div className="font-display text-lg tracking-tightest">{today}</div>
        <div className="text-[12px] text-muted mt-1">
          {formatSecondsSinceChat(health?.seconds_since_chat)}
        </div>
      </div>
      <div className="flex items-center gap-2 relative">
        <button
          data-shortcut="brief"
          className="border border-border px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] hover:border-fg"
          onClick={handleBrief}
        >
          Brief me
        </button>
        <button
          data-shortcut="digest"
          className="border border-border px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] hover:border-fg"
          onClick={handleDigest}
        >
          Run digest
        </button>
        <div className="relative">
          <button
            disabled={producing}
            className="border border-border px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] hover:border-fg disabled:opacity-50"
            onClick={() => setShowInsight((v) => !v)}
          >
            {producing ? 'Queuing…' : 'Produce insight'}
          </button>
          {showInsight && (
            <ProduceInsightPopover
              onSubmit={handleInsight}
              onClose={() => setShowInsight(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
