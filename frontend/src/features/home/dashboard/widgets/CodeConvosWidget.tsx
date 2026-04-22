import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { listCodeConversations } from '../../../../api/code/listCodeConversations';
import type { CodeConversation } from '../../../../api/types/CodeConversation';
import { formatRelative } from '../../../../lib/utils/formatRelative';

export function CodeConvosWidget({ refreshSignal }: { refreshSignal?: unknown }) {
  const [items, setItems] = useState<CodeConversation[]>([]);

  useEffect(() => {
    listCodeConversations()
      .then((r) => setItems(r.conversations ?? []))
      .catch(() => setItems([]));
  }, [refreshSignal]);

  return (
    <div className="border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Code conversations</div>
        <Link to="/code" className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg">
          Open
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-muted">None yet.</div>
      ) : (
        <ul className="space-y-1 text-[12px]">
          {items.slice(0, 5).map((c) => (
            <li key={c.Id} className="flex justify-between gap-2">
              <span className="truncate">{c.title || `Conv #${c.Id}`}</span>
              <span className="shrink-0 text-muted">{formatRelative(c.UpdatedAt || c.CreatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


