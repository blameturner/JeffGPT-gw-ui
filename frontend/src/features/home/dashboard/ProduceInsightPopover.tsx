// frontend/src/features/home/dashboard/ProduceInsightPopover.tsx
import { useState } from 'react';

interface Props {
  onSubmit: (topicHint: string | null) => void;
  onClose: () => void;
}

export function ProduceInsightPopover({ onSubmit, onClose }: Props) {
  const [text, setText] = useState('');
  return (
    <div className="absolute right-0 top-full mt-2 z-10 w-80 rounded border border-border bg-bg p-3 shadow-lg">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
        Optional topic hint
      </p>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Leave blank to auto-pick"
        className="w-full border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-fg"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(text.trim() || null);
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button className="text-[12px] text-muted hover:text-fg" onClick={onClose}>
          Cancel
        </button>
        <button
          className="border border-fg px-3 py-1 text-[12px] text-fg hover:bg-fg hover:text-bg"
          onClick={() => onSubmit(text.trim() || null)}
        >
          Produce
        </button>
      </div>
    </div>
  );
}
