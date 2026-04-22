// frontend/src/features/home/dashboard/Feed.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { listHomeFeed } from '../../../api/home/feed';
import type { FeedItem as FeedItemT } from '../../../api/home/types';
import { FeedItem } from './FeedItem';

interface Props {
  onOpen: (item: FeedItemT) => void;
  refreshKey?: string;
}

function oldestCreatedAt(items: FeedItemT[]): string | undefined {
  if (items.length === 0) return undefined;
  return items
    .map((i) => i.created_at)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
}

export function Feed({ onOpen, refreshKey }: Props) {
  const [items, setItems] = useState<FeedItemT[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const itemsRef = useRef<FeedItemT[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const before = append ? oldestCreatedAt(itemsRef.current) : undefined;
      const res = await listHomeFeed({ limit: 25, before });
      if (append) {
        // Append, de-duplicating by kind+id
        const seen = new Set(itemsRef.current.map((i) => `${i.kind}:${i.id}`));
        const next = res.items.filter((i) => !seen.has(`${i.kind}:${i.id}`));
        const combined = [...itemsRef.current, ...next];
        setItems(combined);
        itemsRef.current = combined;
        if (res.items.length < 25 || next.length === 0) setHasMore(false);
      } else {
        setItems(res.items);
        itemsRef.current = res.items;
        setHasMore(res.items.length === 25);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load, refreshKey]);

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
