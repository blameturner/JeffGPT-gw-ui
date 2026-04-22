// frontend/src/features/home/dashboard/Feed.tsx
import { useEffect, useState, useCallback } from 'react';
import { listHomeFeed } from '../../../api/home/feed';
import type { FeedItem as FeedItemT } from '../../../api/home/types';
import { FeedItem } from './FeedItem';

interface Props {
  onOpen: (item: FeedItemT) => void;
}

export function Feed({ onOpen }: Props) {
  const [items, setItems] = useState<FeedItemT[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await listHomeFeed({ limit: 25 });
      if (append) {
        // Append, de-duplicating by kind+id
        setItems((prev) => {
          const seen = new Set(prev.map((i) => `${i.kind}:${i.id}`));
          const next = res.items.filter((i) => !seen.has(`${i.kind}:${i.id}`));
          return [...prev, ...next];
        });
        if (res.items.length === 0) setHasMore(false);
      } else {
        setItems(res.items);
        setHasMore(res.items.length === 25);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        No activity yet — run a digest or send a chat to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <FeedItem key={`${it.kind}-${it.id}`} item={it} onClick={onOpen} />
      ))}
      {hasMore && (
        <button
          disabled={loadingMore}
          onClick={() => load(true)}
          className="w-full border border-border px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-muted hover:border-fg hover:text-fg disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
