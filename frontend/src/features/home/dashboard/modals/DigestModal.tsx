import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDigest } from '../../../../api/home/digest';
import { postDigestFeedback } from '../../../../api/home/mutations';
import type { DigestMeta } from '../../../../api/home/types';
import { useToast } from '../../../../lib/toast/useToast';
import { ModalShell } from './ModalShell';

interface Props {
  date?: string;
  onClose: () => void;
}

export function DigestModal({ date, onClose }: Props) {
  const [digest, setDigest] = useState<DigestMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    getDigest({ date })
      .then((d) => setDigest(d))
      .finally(() => setLoading(false));
  }, [date]);

  async function sendFeedback(signal: 'up' | 'down') {
    if (!digest) return;
    const res = await postDigestFeedback({ digestId: digest.id, signal });
    if (res.ok) toast.success('Feedback saved');
    else if (res.notConfigured) toast.info('Feedback storage not configured yet');
    else toast.error('Feedback failed');
  }

  return (
    <ModalShell title={digest ? `Digest - ${digest.date}` : 'Digest'} onClose={onClose}>
      {loading && <div className="text-sm text-muted">Loading...</div>}
      {!loading && !digest && <div className="text-sm text-muted">No digest for this date.</div>}
      {digest && (
        <>
          {!digest.markdown_available && (
            <div className="mb-3 border border-yellow-500 bg-yellow-500/10 p-2 text-[12px] text-yellow-400">
              Digest stored but its markdown body is not readable from the API container.
            </div>
          )}
          <div className="mb-3 flex items-center gap-2 text-[12px] text-muted">
            <span>{digest.cluster_count} clusters</span>
            <span>·</span>
            <span>{digest.source_count} sources</span>
            <span className="ml-auto flex gap-1">
              <button
                className="border border-border px-2 py-0.5 hover:border-fg"
                onClick={() => void sendFeedback('up')}
              >
                👍
              </button>
              <button
                className="border border-border px-2 py-0.5 hover:border-fg"
                onClick={() => void sendFeedback('down')}
              >
                👎
              </button>
            </span>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{digest.markdown || '(no body)'}</ReactMarkdown>
          </div>
        </>
      )}
    </ModalShell>
  );
}

