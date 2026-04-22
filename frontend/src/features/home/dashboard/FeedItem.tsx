// frontend/src/features/home/dashboard/FeedItem.tsx
import type { FeedItem as FeedItemT } from '../../../api/home/types';
import { formatRelative } from '../../../lib/utils/formatRelative';

interface Props {
  item: FeedItemT;
  onClick: (item: FeedItemT) => void;
}

const KIND_LABEL: Record<FeedItemT['kind'], string> = {
  digest: 'DIGEST',
  insight: 'INSIGHT',
  question: 'QUESTION',
  run: 'RUN',
};

export function FeedItem({ item, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(item)}
      className="w-full text-left border border-border px-4 py-3 hover:border-fg transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
          {KIND_LABEL[item.kind]}
        </span>
        <span className="text-[11px] text-muted">{formatRelative(item.created_at)}</span>
      </div>
      <div className="font-sans text-[14px] text-fg mt-1">{item.title}</div>
      {item.snippet && (
        <div className="text-[12px] text-muted mt-1 line-clamp-3">{item.snippet}</div>
      )}
    </button>
  );
}
