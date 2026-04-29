import { useEffect, useRef, useState } from 'react';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';
import type { ChatMemoryCategory } from '../../../api/types/ChatMemoryItem';
import type { ChatMemoryState } from '../hooks/useChatMemory';

const REFINEMENTS: { key: string; label: string; prompt: string }[] = [
  { key: 'shorter', label: 'Shorter', prompt: 'Refine your previous reply: make it shorter — keep only the load-bearing claims.' },
  { key: 'concrete', label: 'More concrete', prompt: 'Refine your previous reply: make it more concrete with specific examples or numbers.' },
  { key: 'challenge', label: 'Challenge this', prompt: 'Push back on your previous reply: where could you be wrong, and why?' },
  { key: 'example', label: 'Give an example', prompt: 'Give a single, concrete example illustrating your previous reply.' },
  { key: 'missing', label: 'What am I missing', prompt: 'What is missing from your previous reply that I should know?' },
];

interface Props {
  message: DisplayMessage;
  sending: boolean;
  onRefine: (prompt: string) => void;
  onReroll: () => void;
  onFork: () => void;
  onPin: (body: { category: ChatMemoryCategory; text: string; pinned: boolean }) => void;
  memory: ChatMemoryState;
}

function guessCategory(text: string): ChatMemoryCategory {
  const t = text.toLowerCase();
  if (/\b(decid|will|let'?s|going to|chose|pick(ed)?)\b/.test(t)) return 'decision';
  if (text.includes('?')) return 'thread';
  return 'fact';
}

function summarize(text: string): string {
  const trimmed = text.trim().split('\n')[0]?.trim() ?? '';
  if (trimmed.length <= 160) return trimmed;
  return trimmed.slice(0, 157) + '…';
}

export function MessageActions({
  message,
  sending,
  onRefine,
  onReroll,
  onFork,
  onPin,
}: Props) {
  const [pinOpen, setPinOpen] = useState(false);

  if (message.role !== 'assistant' || message.status !== 'complete' || !message.content) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pl-5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      {REFINEMENTS.map((r) => (
        <button
          key={r.key}
          type="button"
          disabled={sending}
          onClick={() => onRefine(r.prompt)}
          className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded-full border border-border text-muted hover:border-fg hover:text-fg disabled:opacity-40"
        >
          {r.label}
        </button>
      ))}

      <span className="w-px h-3 bg-border mx-1" />

      <button
        type="button"
        disabled={sending}
        onClick={() => setPinOpen(true)}
        className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded-full border border-border text-muted hover:border-fg hover:text-fg disabled:opacity-40"
        title="Pin a fact from this reply to memory"
      >
        📌 Pin
      </button>
      <button
        type="button"
        disabled={sending}
        onClick={onReroll}
        className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded-full border border-border text-muted hover:border-fg hover:text-fg disabled:opacity-40"
        title="Regenerate this reply"
      >
        ↻ Re-roll
      </button>
      <button
        type="button"
        disabled={sending}
        onClick={onFork}
        className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded-full border border-border text-muted hover:border-fg hover:text-fg disabled:opacity-40"
        title="Fork conversation from this point"
      >
        ⑂ Fork
      </button>

      {pinOpen && (
        <PinToMemoryPopover
          initialText={summarize(message.content)}
          initialCategory={guessCategory(message.content)}
          onCancel={() => setPinOpen(false)}
          onSubmit={(body) => {
            onPin(body);
            setPinOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PinToMemoryPopover({
  initialText,
  initialCategory,
  onCancel,
  onSubmit,
}: {
  initialText: string;
  initialCategory: ChatMemoryCategory;
  onCancel: () => void;
  onSubmit: (body: { category: ChatMemoryCategory; text: string; pinned: boolean }) => void;
}) {
  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState<ChatMemoryCategory>(initialCategory);
  const [pinned, setPinned] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="absolute z-30 mt-2 w-80 bg-bg border border-border rounded-md shadow-card p-3 space-y-3"
      role="dialog"
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-1">Category</p>
        <div className="flex gap-1">
          {(['fact', 'decision', 'thread'] as ChatMemoryCategory[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={[
                'text-[11px] font-sans px-2 py-1 rounded border',
                category === c
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border text-muted hover:border-fg hover:text-fg',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-1">Text</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-fg resize-none"
        />
      </div>
      <label className="flex items-center gap-2 text-[11px] font-sans">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
        />
        Pin (include in every prompt)
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onSubmit({ category, text: text.trim(), pinned })}
          className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded border border-fg text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
