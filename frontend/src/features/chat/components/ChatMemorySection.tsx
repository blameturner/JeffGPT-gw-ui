import { useMemo, useState } from 'react';
import type {
  ChatMemoryCategory,
  ChatMemoryItem,
} from '../../../api/types/ChatMemoryItem';
import type { ChatMemoryState } from '../hooks/useChatMemory';

const CATEGORY_LABEL: Record<ChatMemoryCategory, string> = {
  fact: 'Facts',
  decision: 'Decisions',
  thread: 'Open threads',
};

const CATEGORY_ORDER: ChatMemoryCategory[] = ['fact', 'decision', 'thread'];

interface Props {
  memory: ChatMemoryState;
  disabled?: boolean;
}

export function ChatMemorySection({ memory, disabled }: Props) {
  const counts = useMemo(() => {
    const c: Record<ChatMemoryCategory, number> = { fact: 0, decision: 0, thread: 0 };
    let proposed = 0;
    for (const item of memory.items) {
      if (item.status === 'rejected') continue;
      c[item.category] += 1;
      if (item.status === 'proposed') proposed += 1;
    }
    return { ...c, proposed };
  }, [memory.items]);

  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">Chat memory</h4>
          {counts.proposed > 0 && (
            <span className="text-[10px] uppercase tracking-[0.14em] font-sans px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 border border-amber-600/40">
              {counts.proposed} to review
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void memory.runExtract()}
            disabled={disabled || memory.extracting}
            title="Re-extract memory from chat"
            className="text-[10px] uppercase tracking-[0.14em] font-sans text-fg hover:underline underline-offset-4 disabled:opacity-40"
          >
            {memory.extracting ? '...' : '↻ Re-extract'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-1 mb-3 text-[10px] font-sans">
        <CountChip label="Facts" value={counts.fact} />
        <CountChip label="Decisions" value={counts.decision} />
        <CountChip label="Threads" value={counts.thread} />
      </div>

      {memory.lastExtractDelta != null && memory.lastExtractDelta > 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-600/30 rounded-md px-2.5 py-1.5 mb-3">
          {memory.lastExtractDelta} new item{memory.lastExtractDelta === 1 ? '' : 's'} proposed for review.
        </p>
      )}

      {memory.error && (
        <p className="text-[11px] text-red-600 mb-2 font-sans">{memory.error}</p>
      )}

      <div className="space-y-3">
        {CATEGORY_ORDER.map((cat) => (
          <CategoryAccordion
            key={cat}
            category={cat}
            items={memory.items.filter((it) => it.category === cat && it.status !== 'rejected')}
            memory={memory}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-md px-2 py-1 text-center bg-bg">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="text-[14px] font-display font-semibold">{value}</div>
    </div>
  );
}

function CategoryAccordion({
  category,
  items,
  memory,
  disabled,
}: {
  category: ChatMemoryCategory;
  items: ChatMemoryItem[];
  memory: ChatMemoryState;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const proposedCount = items.filter((it) => it.status === 'proposed').length;

  return (
    <details open className="group border border-border rounded-md bg-bg">
      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
          <h5 className="text-[11px] uppercase tracking-[0.14em] font-sans text-fg">
            {CATEGORY_LABEL[category]}
          </h5>
          <span className="text-[10px] font-sans text-muted">({items.length})</span>
          {proposedCount > 0 && (
            <span className="text-[9px] uppercase tracking-[0.14em] font-sans px-1 py-0.5 rounded bg-amber-500/20 text-amber-700">
              {proposedCount} proposed
            </span>
          )}
        </div>
      </summary>

      {proposedCount > 0 && (
        <div className="px-3 pb-1 -mt-1">
          <button
            type="button"
            onClick={() => void memory.acceptAllProposed()}
            disabled={disabled}
            className="text-[10px] uppercase tracking-[0.14em] font-sans text-fg hover:underline underline-offset-4 disabled:opacity-40"
          >
            Accept all proposed
          </button>
        </div>
      )}

      <ul className="px-2 pb-2 space-y-1">
        {items.length === 0 && !adding && (
          <li className="text-[11px] text-muted font-sans px-2 py-2">No items yet.</li>
        )}
        {items.map((it) => (
          <MemoryRow key={it.Id} item={it} memory={memory} disabled={disabled} />
        ))}
        {adding && (
          <li className="px-2 py-2 border border-dashed border-border rounded-md">
            <textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder={`Add a ${category}…`}
              autoFocus
              rows={2}
              className="w-full bg-bg border border-border rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-fg resize-none"
            />
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setAddText('');
                }}
                className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!addText.trim()}
                onClick={async () => {
                  const text = addText.trim();
                  if (!text) return;
                  setAdding(false);
                  setAddText('');
                  await memory.add({ category, text, status: 'active', pinned: false });
                }}
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded border border-fg text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </li>
        )}
      </ul>

      {!adding && (
        <div className="px-3 pb-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAdding(true)}
            className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg disabled:opacity-40"
          >
            + Add {category}
          </button>
        </div>
      )}
    </details>
  );
}

function MemoryRow({
  item,
  memory,
  disabled,
}: {
  item: ChatMemoryItem;
  memory: ChatMemoryState;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const isProposed = item.status === 'proposed';

  async function saveEdit() {
    const text = draft.trim();
    setEditing(false);
    if (!text || text === item.text) return;
    const patch =
      item.status === 'proposed'
        ? { text, status: 'active' as const }
        : { text };
    await memory.update(item.Id, patch);
  }

  return (
    <li
      className={[
        'group/row relative px-2 py-1.5 rounded border text-[12px] leading-snug',
        isProposed
          ? 'bg-amber-500/10 border-amber-600/40'
          : 'bg-bg border-border hover:border-fg/40',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={item.pinned ? 'Unpin' : 'Pin'}
          title={item.pinned ? 'Pinned — included in every prompt' : 'Pin to include in every prompt'}
          disabled={disabled}
          onClick={() => void memory.togglePin(item.Id)}
          className={[
            'shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded transition-colors',
            item.pinned ? 'text-fg' : 'text-muted/50 hover:text-fg',
          ].join(' ')}
        >
          {item.pinned ? '📌' : '📍'}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void saveEdit()}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void saveEdit();
                }
                if (e.key === 'Escape') {
                  setDraft(item.text);
                  setEditing(false);
                }
              }}
              rows={2}
              autoFocus
              className="w-full bg-bg border border-border rounded px-1.5 py-1 text-[12px] focus:outline-none focus:border-fg resize-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(item.text);
                setEditing(true);
              }}
              disabled={disabled}
              className={[
                'block w-full text-left',
                item.status === 'rejected' ? 'line-through text-muted' : 'text-fg',
              ].join(' ')}
            >
              {item.text}
            </button>
          )}

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item.confidence > 0 && (
              <span className="text-[9px] font-sans text-muted">
                conf · {item.confidence.toFixed(2)}
              </span>
            )}
            {item.pinned && !editing && (
              <span className="text-[9px] uppercase tracking-[0.14em] font-sans text-fg">
                pinned
              </span>
            )}
          </div>
        </div>

        {!editing && (
          <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            {isProposed && (
              <>
                <button
                  type="button"
                  title="Accept"
                  onClick={() => void memory.accept(item.Id)}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-fg text-fg hover:bg-fg hover:text-bg"
                >
                  ✓
                </button>
                <button
                  type="button"
                  title="Reject"
                  onClick={() => void memory.reject(item.Id)}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted hover:border-red-600 hover:text-red-600"
                >
                  ✗
                </button>
              </>
            )}
            <button
              type="button"
              title="Delete"
              onClick={() => void memory.remove(item.Id)}
              className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted hover:border-red-600 hover:text-red-600"
            >
              🗑
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
