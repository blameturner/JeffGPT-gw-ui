import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { downloadHomeConversation } from '../../../api/home/conversationExport';
import { useHomeChat } from '../hooks/useHomeChat';
import { ChatMessage } from './ChatMessage';

export interface HomeChatHandle {
  attachStream: (jobId: string) => void;
  focusInput: () => void;
  refresh: () => void;
}

interface Props {
  conversationId?: number | null;
}

type SearchMode = 'disabled' | 'basic' | 'standard';

const SEARCH_MODES: { value: SearchMode; label: string; title: string }[] = [
  { value: 'disabled', label: 'Off', title: 'No web search' },
  { value: 'basic', label: 'Basic', title: 'Lightweight web search' },
  { value: 'standard', label: 'Standard', title: 'Standard web search' },
];

export const HomeChat = forwardRef<HomeChatHandle, Props>(function HomeChat({ conversationId }, ref) {
  const { messages, sending, send, attachStream, refresh } = useHomeChat(conversationId);
  const [text, setText] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('basic');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    attachStream,
    focusInput: () => textareaRef.current?.focus(),
    refresh,
  }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  async function handleSend() {
    const t = text.trim();
    if (!t || sending) return;
    setText('');
    await send(t, searchMode);
  }

  return (
    <div className="flex h-full flex-col border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-fg/70" aria-hidden />
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Home chat</div>
        </div>
        <button
          onClick={() => downloadHomeConversation()}
          className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
        >
          Export
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto px-3 sm:px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <div className="text-[13px] text-fg/80">Say hi.</div>
            <div className="mt-1 text-[12px] text-muted">
              Today's digest is already in context.
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted">
              Press <kbd className="px-1 py-0.5 border border-border text-[10px]">/</kbd> to focus
            </div>
          </div>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} m={m} />)
        )}
      </div>

      <div className="border-t border-border bg-bg/95 backdrop-blur">
        <div className="px-3 sm:px-4 pt-2 pb-1 flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-sans">
            Search
          </span>
          <div className="flex items-center gap-1">
            {SEARCH_MODES.map((m) => {
              const active = searchMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSearchMode(m.value)}
                  title={m.title}
                  className={[
                    'text-[11px] font-sans px-2 py-1 rounded border transition-colors flex items-center gap-1.5',
                    active
                      ? 'border-fg bg-fg text-bg'
                      : 'border-border text-muted hover:border-fg hover:text-fg',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-1.5 h-1.5 rounded-full',
                      active ? 'bg-bg' : 'bg-border',
                    ].join(' ')}
                    aria-hidden
                  />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 sm:px-4 pt-1 pb-3">
          <div className="flex items-end gap-2 border border-border rounded-xl bg-panel/40 focus-within:border-fg transition-colors px-3 py-2 shadow-card">
            <textarea
              ref={textareaRef}
              data-chat-input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder="Message…"
              disabled={sending}
              className="flex-1 bg-transparent resize-none outline-none text-[14px] leading-relaxed placeholder:text-muted disabled:opacity-50 min-h-[1.6em] max-h-[200px] overflow-y-auto"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !text.trim()}
              className="shrink-0 px-3 py-1.5 rounded-md bg-fg text-bg text-[12px] font-medium tracking-wide hover:bg-fg/85 transition-colors disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
          <p className="hidden sm:block text-[10px] uppercase tracking-[0.14em] text-muted font-sans mt-2">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
});
