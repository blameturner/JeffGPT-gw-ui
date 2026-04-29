import { useEffect, useRef, useState } from 'react';
import type { SavedFragment } from '../../../api/types/SavedFragment';

interface Props {
  fragments: SavedFragment[];
  onInsert: (text: string) => void;
  onAdd: (fragment: SavedFragment) => void;
  disabled?: boolean;
}

export function SavedFragmentsMenu({ fragments, onInsert, onAdd, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftText, setDraftText] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Saved fragments"
        aria-label="Saved fragments"
        className="shrink-0 w-9 h-9 rounded-md border border-border text-muted hover:border-fg hover:text-fg transition-colors flex items-center justify-center text-sm disabled:opacity-40"
      >
        ✱
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-72 max-h-80 overflow-y-auto bg-bg border border-border rounded-md shadow-card z-30">
          {fragments.length === 0 && !adding && (
            <p className="px-3 py-2 text-[11px] text-muted font-sans">No fragments yet.</p>
          )}
          <ul>
            {fragments.map((f, i) => (
              <li key={`${f.label}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    onInsert(f.text);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-panelHi border-b border-border last:border-b-0"
                >
                  <p className="text-[12px] font-medium truncate">{f.label}</p>
                  <p className="text-[10px] text-muted line-clamp-2">{f.text}</p>
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <div className="px-3 py-2 border-t border-border space-y-2">
              <input
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder="Label"
                className="w-full bg-bg border border-border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-fg"
              />
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Fragment text"
                rows={3}
                className="w-full bg-bg border border-border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-fg resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg"
                  onClick={() => {
                    setAdding(false);
                    setDraftLabel('');
                    setDraftText('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!draftLabel.trim() || !draftText.trim()}
                  onClick={() => {
                    onAdd({ label: draftLabel.trim(), text: draftText.trim() });
                    setAdding(false);
                    setDraftLabel('');
                    setDraftText('');
                  }}
                  className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded border border-fg text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full text-left px-3 py-2 text-[11px] uppercase tracking-[0.14em] font-sans text-fg border-t border-border hover:bg-panelHi"
            >
              + Add fragment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
