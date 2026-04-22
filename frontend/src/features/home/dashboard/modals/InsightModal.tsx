import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getInsight } from '../../../../api/home/insights';
import type { Insight } from '../../../../api/home/types';
import { formatRelative } from '../../../../lib/utils/formatRelative';
import { ModalShell } from './ModalShell';

interface Props {
  id: number;
  onClose: () => void;
}

export function InsightModal({ id, onClose }: Props) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getInsight(id)
      .then(setInsight)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <ModalShell title={insight?.title || 'Insight'} onClose={onClose}>
      {loading && <div className="text-sm text-muted">Loading...</div>}
      {insight && (
        <>
          <div className="mb-3 text-[12px] text-muted">
            {insight.topic} · {insight.trigger} · {formatRelative(insight.created_at)}
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight.body_markdown}</ReactMarkdown>
          </div>
          {insight.sources.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted">Sources</div>
              <ul className="space-y-0.5 text-[12px]">
                {insight.sources.map((s, i) => (
                  <li key={`${s.url}-${i}`}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-fg"
                    >
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}

