import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import type { Conversation } from '../api/types/Conversation';

interface Props {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (c: Conversation) => void;
  loading: boolean;
}

export function ConversationList({ conversations, activeId, onSelect, loading }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const aTime = a.UpdatedAt ? new Date(a.UpdatedAt).getTime() : 0;
        const bTime = b.UpdatedAt ? new Date(b.UpdatedAt).getTime() : 0;
        return bTime - aTime;
      }),
    [conversations],
  );

  // scroll active item into view when it changes (e.g. after selecting a new chat)
  useEffect(() => {
    if (activeId == null || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLButtonElement>(
      `[data-conv-id="${activeId}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  function focusIndex(i: number) {
    const el = listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-conv-id]')[i];
    el?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLUListElement>) {
    if (sorted.length === 0) return;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-conv-id]');
    if (!buttons || buttons.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    const currentIdx = Array.from(buttons).findIndex((b) => b === current);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex(Math.min(buttons.length - 1, currentIdx + 1 < 0 ? 0 : currentIdx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIndex(Math.max(0, currentIdx - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusIndex(buttons.length - 1);
    }
  }

  if (loading) {
    return <p className="text-muted text-sm px-3 py-2">Loading…</p>;
  }
  if (conversations.length === 0) {
    return (
      <p className="text-muted text-sm px-3 py-2">
        No conversations yet. Start one below.
      </p>
    );
  }

  return (
    <ul
      ref={listRef}
      onKeyDown={onKey}
      className="space-y-1"
      role="listbox"
      aria-label="Conversations"
    >
      {sorted.map((c) => {
        const isActive = c.Id === activeId;
        const isProcessing = c.status === 'processing';
        return (
          <li key={c.Id}>
            <button
              onClick={() => onSelect(c)}
              data-conv-id={c.Id}
              role="option"
              aria-selected={isActive}
              className={`w-full text-left px-3 py-2 rounded border transition truncate focus:outline-none focus:ring-1 focus:ring-fg ${
                isActive
                  ? 'bg-panelHi border-accent'
                  : 'bg-panel border-border hover:border-accentDim'
              }`}
              title={c.title || 'Untitled'}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isProcessing && (
                  <span
                    aria-label="processing"
                    title="This conversation is still generating"
                    className="shrink-0 w-1.5 h-1.5 rounded-full bg-fg animate-pulse"
                  />
                )}
                <div className="text-sm font-medium truncate flex-1 min-w-0">
                  {c.title || 'Untitled'}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted truncate">
                {c.model}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
