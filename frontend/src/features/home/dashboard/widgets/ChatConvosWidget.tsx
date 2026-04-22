import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { listConversations } from '../../../../api/chat/listConversations';
import type { Conversation } from '../../../../api/types/Conversation';
import { formatRelative } from '../../../../lib/utils/formatRelative';

export function ChatConvosWidget({ refreshSignal }: { refreshSignal?: unknown }) {
  const [items, setItems] = useState<Conversation[]>([]);

  useEffect(() => {
    listConversations()
      .then((r) => setItems(r.conversations ?? []))
      .catch(() => setItems([]));
  }, [refreshSignal]);

  return (
    <div className="border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Chat conversations</div>
        <Link to="/chat" className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg">
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
