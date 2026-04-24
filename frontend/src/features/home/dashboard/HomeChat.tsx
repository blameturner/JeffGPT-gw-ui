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

export const HomeChat = forwardRef<HomeChatHandle, Props>(function HomeChat({ conversationId }, ref) {
  const { messages, sending, send, attachStream, refresh } = useHomeChat(conversationId);
  const [text, setText] = useState('');
  const [searchMode, setSearchMode] = useState<'disabled' | 'basic' | 'standard'>('basic');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    attachStream,
    focusInput: () => inputRef.current?.focus(),
    refresh,
  }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const t = text;
    setText('');
    await send(t, searchMode);
  }

  return (
    <div className="flex h-full flex-col border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Home chat</div>
        <button
          onClick={() => downloadHomeConversation()}
          className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
        >
          Export
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="text-[12px] text-muted">Say hi. Today's digest is already in context.</div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} m={m} />
        ))}
      </div>

      <div className="border-t border-border p-2 space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            data-chat-input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            className="flex-1 min-w-0 border border-border bg-transparent px-2 py-2 text-[14px] sm:text-[13px] outline-none focus:border-fg"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <button
            disabled={sending || !text.trim()}
            onClick={() => void handleSend()}
            className="shrink-0 border border-fg px-3 py-2 text-[12px] uppercase tracking-[0.14em] text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <select
          value={searchMode}
          onChange={(e) => setSearchMode(e.target.value as 'disabled' | 'basic' | 'standard')}
          className="w-full sm:w-auto border border-border bg-transparent px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-muted"
          aria-label="Search mode"
        >
          <option value="disabled">No search</option>
          <option value="basic">Basic search</option>
          <option value="standard">Standard search</option>
        </select>
      </div>
    </div>
  );
});


