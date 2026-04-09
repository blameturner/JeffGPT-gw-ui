import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  api,
  type ChatMessageRow,
  type Conversation,
  type ConversationSummary,
  type LlmModel,
} from '../lib/api';
import { authClient } from '../lib/auth-client';
import { ConversationList } from '../components/ConversationList';
import { ChatBubble, type DisplayMessage } from '../components/ChatBubble';


function uid() {
  return Math.random().toString(36).slice(2);
}

function ChatPage() {
  const navigate = useNavigate();

  // sidebar state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);

  // models
  const [models, setModels] = useState<LlmModel[]>([]);
  const [model, setModel] = useState<string>('');

  // thread state
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // composer
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Memory (RAG) — only applied on the first message of a NEW conversation.
  // Once the conversation exists on the harness, its rag setting is sticky
  // and this flag is ignored.
  const [ragEnabled, setRagEnabled] = useState(false);
  // Knowledge graph writes (FalkorDB) — same first-turn-only semantics.
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false);
  // Web search — per-message toggle, resets to off after each send.
  const [searchEnabled, setSearchEnabled] = useState(false);
  // Abort controller for the in-flight stream, so we can cancel on unmount
  // or new-chat.
  const streamAbortRef = useRef<AbortController | null>(null);

  // Properties drawer (right rail). Hosts rename + stats + details.
  // Manual refresh only — stats never auto-hydrate.
  const [stats, setStats] = useState<ConversationSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');

  async function refreshStats() {
    if (activeId == null) {
      setStats(null);
      return;
    }
    setLoadingStats(true);
    try {
      const summary = await api.conversationSummary(activeId);
      setStats(summary);
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial load: conversations + models in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [convRes, modelsRes] = await Promise.all([api.conversations(), api.models()]);
        if (cancelled) return;
        setConversations(convRes.conversations);
        setModels(modelsRes.models);
        if (modelsRes.models[0]) setModel(modelsRes.models[0].name);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  // Auto-grow the composer textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  async function selectConversation(c: Conversation) {
    setActiveId(c.Id);
    setModel(c.model || model);
    setLoadingMessages(true);
    setError(null);
    setStats(null);
    setRenameTitle(c.title || '');
    try {
      const res = await api.conversationMessages(c.Id);
      setMessages(
        res.messages
          .filter((m: ChatMessageRow) => m.role !== 'system')
          .map<DisplayMessage>((m: ChatMessageRow) => ({
            id: String(m.Id),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            status: 'complete',
            tokensIn: m.tokens_input,
            tokensOut: m.tokens_output,
          })),
      );
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load conversation');
    } finally {
      setLoadingMessages(false);
    }
  }

  function newChat() {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setActiveId(null);
    setMessages([]);
    setError(null);
    setStats(null);
    setRenameTitle('');
    setRagEnabled(false);
    setKnowledgeEnabled(false);
    setSearchEnabled(false);
    textareaRef.current?.focus();
  }

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending || !model) return;

    const userMsg: DisplayMessage = {
      id: uid(),
      role: 'user',
      content: text,
      status: 'complete',
    };
    const pendingId = uid();
    const pendingMsg: DisplayMessage = {
      id: pendingId,
      role: 'assistant',
      content: '',
      status: 'pending',
      startedAt: Date.now(),
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput('');
    setSending(true);
    setError(null);

    // rag_enabled / knowledge_enabled only go out on the first message of a
    // new chat. The harness persists the setting on the conversations row
    // and ignores these fields on subsequent turns.
    const isFirstMessage = activeId == null;
    const searchForThisTurn = searchEnabled;
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const stream = api.chatStream(
        {
          model,
          message: text,
          conversation_id: activeId ?? undefined,
          ...(isFirstMessage && ragEnabled ? { rag_enabled: true } : {}),
          ...(isFirstMessage && knowledgeEnabled ? { knowledge_enabled: true } : {}),
          ...(searchForThisTurn ? { search_enabled: true } : {}),
        },
        controller.signal,
      );

      let firstChunkSeen = false;
      let newConversationId: number | null = null;

      for await (const ev of stream) {
        if (ev.type === 'searching') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId ? { ...x, status: 'searching' } : x,
            ),
          );
          continue;
        }
        if (ev.type === 'search_complete') {
          const sources = ev.sources;
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'pending', sources }
                : x,
            ),
          );
          continue;
        }
        if (ev.type === 'chunk') {
          if (!firstChunkSeen) {
            firstChunkSeen = true;
          }
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'streaming', content: x.content + ev.text }
                : x,
            ),
          );
        } else if (ev.type === 'summarised') {
          // Splice a synthetic system notice *before* the assistant bubble.
          const notice: DisplayMessage = {
            id: uid(),
            role: 'system',
            status: 'system',
            content: `Trimmed ${ev.removed} earlier message${ev.removed === 1 ? '' : 's'} (≈${ev.summary_chars.toLocaleString()} chars summarised)`,
          };
          setMessages((ms) => {
            const idx = ms.findIndex((x) => x.id === pendingId);
            if (idx < 0) return [...ms, notice];
            const copy = ms.slice();
            copy.splice(idx, 0, notice);
            return copy;
          });
        } else if (ev.type === 'meta') {
          // Early conversation_id from harness — capture before 'done'.
          if (ev.conversation_id != null) newConversationId = ev.conversation_id;
        } else if (ev.type === 'done') {
          if (ev.conversation_id != null) newConversationId = ev.conversation_id;
          // Harness may emit token counts under either shape.
          const tokIn = ev.usage?.prompt_tokens ?? ev.tokens_input;
          const tokOut = ev.usage?.completion_tokens ?? ev.tokens_output;
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    status: 'complete',
                    startedAt: undefined,
                    tokensIn: tokIn,
                    tokensOut: tokOut,
                    contextChars:
                      ev.context_chars && ev.context_chars > 0 ? ev.context_chars : undefined,
                  }
                : x,
            ),
          );
        } else if (ev.type === 'error') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'error', errorMessage: ev.message }
                : x,
            ),
          );
          break;
        }
      }

      // First message in a brand-new conversation — capture the returned id
      // and refresh the sidebar so it appears.
      if (isFirstMessage && newConversationId != null) {
        setActiveId(newConversationId);
        try {
          const convRes = await api.conversations();
          setConversations(convRes.conversations);
        } catch {
          /* non-fatal */
        }
      }
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError';
      if (!aborted) {
        const msg = (err as Error)?.message ?? 'Send failed';
        setMessages((ms) =>
          ms.map((x) =>
            x.id === pendingId ? { ...x, status: 'error', errorMessage: msg } : x,
          ),
        );
        setError(msg);
      }
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
      setSending(false);
      // Search is per-message — reset after each turn.
      setSearchEnabled(false);
    }
  }

  async function logout() {
    await authClient.signOut();
    await navigate({ to: '/login' });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const activeConversation =
    activeId != null ? conversations.find((c) => c.Id === activeId) ?? null : null;

  return (
    <div className="h-full flex bg-bg text-fg">
      {/* ——— Sidebar ——— */}
      <aside className="w-80 border-r border-border bg-panel/60 flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="font-display text-3xl font-semibold tracking-tightest leading-none">
            Jeff<span className="italic">GPT</span>
            <span className="inline-block w-2 h-2 bg-fg rounded-full align-middle ml-2" />
          </h1>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted mt-2">
            local intelligence
          </p>
        </div>

        <div className="px-4 pt-4 pb-2">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-fg bg-bg text-fg text-sm font-medium hover:bg-fg hover:text-bg transition-colors"
          >
            <span>New conversation</span>
            <span className="text-lg leading-none">＋</span>
          </button>
        </div>

        <div className="px-4 pb-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted mt-3 mb-1 px-1">
            History
          </p>
        </div>
        <div className="px-3 flex-1 overflow-y-auto pb-4">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={selectConversation}
            loading={loadingConversations}
          />
        </div>

      </aside>


      {/* ——— Main thread ——— */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border bg-bg/80 backdrop-blur px-8 py-5 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
              {activeConversation ? 'Conversation' : 'New conversation'}
            </p>
            <h2 className="font-display text-xl font-semibold truncate tracking-tightest">
              {activeConversation?.title || 'Untitled'}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-bg border border-border px-3 py-1.5 rounded-md text-sm font-mono focus:outline-none focus:border-fg transition-colors"
            >
              {models.length === 0 ? (
                <option value="">No models</option>
              ) : (
                models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className={[
                'text-[11px] uppercase tracking-[0.14em] font-mono px-3 py-1.5 rounded-md border transition-colors',
                drawerOpen
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border text-fg hover:bg-panelHi',
              ].join(' ')}
              title="Show chat properties"
            >
              Properties
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-10">
          <div className="max-w-3xl mx-auto space-y-5">
            {loadingMessages ? (
              <p className="text-center text-muted text-sm pt-16">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <div className="pt-20 text-center">
                <p className="font-display text-4xl font-semibold tracking-tightest leading-tight">
                  Ask anything.
                </p>
                <p className="text-muted text-sm mt-3 font-mono">
                  {model ? `Model · ${model}` : 'Select a model to begin'}
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="space-y-1">
                  <ChatBubble message={m} />
                  {m.role === 'assistant' && m.status === 'complete' && m.contextChars != null && (
                    <div className="flex justify-start">
                      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted pl-5">
                        Memory · {m.contextChars.toLocaleString()} chars of context
                        {m.tokensOut != null && (
                          <span className="ml-2">· {m.tokensOut.toLocaleString()} tok out</span>
                        )}
                      </span>
                    </div>
                  )}
                  {m.role === 'assistant' &&
                    m.status === 'complete' &&
                    m.contextChars == null &&
                    m.tokensOut != null && (
                      <div className="flex justify-start">
                        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted pl-5">
                          {m.tokensOut.toLocaleString()} tok out
                          {m.tokensIn != null && (
                            <span className="ml-2">· {m.tokensIn.toLocaleString()} in</span>
                          )}
                        </span>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        </div>

        {error && (
          <div className="px-6 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-red-600 font-mono">{error}</p>
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border bg-bg px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 border border-border rounded-xl bg-panel/40 focus-within:border-fg transition-colors px-4 py-3 shadow-card">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={
                  model
                    ? 'Message JeffGPT…  (Shift+Enter for newline)'
                    : 'Load a model to start'
                }
                disabled={!model || sending}
                className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed placeholder:text-muted disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!model || !input.trim() || sending}
                className="shrink-0 px-4 py-2 rounded-md bg-fg text-bg text-sm font-medium tracking-wide hover:bg-fg/85 transition-colors disabled:opacity-40"
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-mono">
                Enter to send · Shift+Enter for newline
              </p>
              {/*
                Memory toggle — only meaningful on the first message of a new
                conversation. Once activeId is set, the conversation's RAG
                setting is sticky on the harness side and we disable the toggle.
              */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRagEnabled((v) => !v)}
                  disabled={activeId != null}
                  title={
                    activeId != null
                      ? 'Memory is set when a conversation is first created'
                      : 'Use past conversations as context'
                  }
                  className={[
                    'text-[10px] uppercase tracking-[0.14em] font-mono px-2.5 py-1 rounded-full border transition-colors',
                    activeId != null
                      ? 'border-border text-muted opacity-50 cursor-not-allowed'
                      : ragEnabled
                        ? 'border-fg bg-fg text-bg'
                        : 'border-border text-muted hover:border-fg hover:text-fg',
                  ].join(' ')}
                >
                  {ragEnabled ? '● Memory on' : '○ Memory off'}
                </button>
                <button
                  type="button"
                  onClick={() => setKnowledgeEnabled((v) => !v)}
                  disabled={activeId != null}
                  title={
                    activeId != null
                      ? 'Knowledge graph is set when a conversation is first created'
                      : 'Extract entities and write concept edges to the knowledge graph'
                  }
                  className={[
                    'text-[10px] uppercase tracking-[0.14em] font-mono px-2.5 py-1 rounded-full border transition-colors',
                    activeId != null
                      ? 'border-border text-muted opacity-50 cursor-not-allowed'
                      : knowledgeEnabled
                        ? 'border-fg bg-fg text-bg'
                        : 'border-border text-muted hover:border-fg hover:text-fg',
                  ].join(' ')}
                >
                  {knowledgeEnabled ? '● Knowledge on' : '○ Knowledge off'}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchEnabled((v) => !v)}
                  disabled={sending}
                  title="Run a web search for this message"
                  className={[
                    'text-[10px] uppercase tracking-[0.14em] font-mono px-2.5 py-1 rounded-full border transition-colors',
                    searchEnabled
                      ? 'border-fg bg-fg text-bg'
                      : 'border-border text-muted hover:border-fg hover:text-fg',
                  ].join(' ')}
                >
                  {searchEnabled ? '● Search on' : '○ Search off'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ——— Right rail: Properties drawer ——— */}
      {drawerOpen && (
        <aside className="w-[380px] shrink-0 border-l border-border bg-panel/40 flex flex-col animate-fadeIn">
          <header className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-border">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Chat</p>
              <h3 className="font-display text-lg font-semibold tracking-tightest truncate">
                Properties
              </h3>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="text-fg text-xl leading-none px-2 -mr-2 hover:opacity-60"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 text-sm">
            {/* Rename */}
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                Title
              </h4>
              <input
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder={activeConversation?.title || 'Untitled'}
                disabled={activeId == null}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-fg disabled:opacity-50"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] font-mono text-muted">
                  Save requires harness endpoint
                </p>
                <button
                  type="button"
                  disabled
                  title="Needs PATCH /conversations/{id} on harness"
                  className="text-[10px] uppercase tracking-[0.14em] font-mono px-3 py-1 rounded border border-border text-muted cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </section>

            {/* Settings (placeholders for per-turn controls) */}
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                Settings
              </h4>
              <dl className="grid grid-cols-2 gap-y-1.5 text-[12px] font-mono">
                <dt className="text-muted">Model</dt>
                <dd className="text-right truncate">{model || '—'}</dd>
                <dt className="text-muted">Memory</dt>
                <dd className="text-right">
                  {activeId == null
                    ? ragEnabled
                      ? 'on (first turn)'
                      : 'off'
                    : (stats?.conversation as any)?.rag_enabled
                      ? 'on'
                      : 'sticky'}
                </dd>
                <dt className="text-muted">Knowledge</dt>
                <dd className="text-right">
                  {activeId == null ? (knowledgeEnabled ? 'on (first turn)' : 'off') : 'sticky'}
                </dd>
                <dt className="text-muted">Search</dt>
                <dd className="text-right">{searchEnabled ? 'on (next turn)' : 'off'}</dd>
              </dl>
              <p className="text-[10px] font-mono text-muted mt-2 leading-relaxed">
                Memory / Knowledge are captured when the chat is first created.
                Search is per-turn. Toggle in the composer below.
              </p>
            </section>

            {/* Stats header + refresh */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">Stats</h4>
                <button
                  onClick={() => void refreshStats()}
                  disabled={activeId == null || loadingStats}
                  className="text-[10px] uppercase tracking-[0.14em] font-mono text-fg hover:underline underline-offset-4 disabled:opacity-40"
                >
                  {loadingStats ? '…' : 'Refresh'}
                </button>
              </div>

              {activeId == null ? (
                <p className="text-[11px] text-muted font-mono">Select a conversation.</p>
              ) : stats == null ? (
                <p className="text-[11px] text-muted font-mono">Tap refresh to load.</p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-y-1 text-[11px] font-mono">
                    <dt className="text-muted">messages</dt>
                    <dd className="text-right">{stats.message_count}</dd>
                    <dt className="text-muted">runs</dt>
                    <dd className="text-right">{stats.run_count}</dd>
                    <dt className="text-muted">observations</dt>
                    <dd className="text-right">{stats.observation_count}</dd>
                    <dt className="text-muted">tasks</dt>
                    <dd className="text-right">{stats.task_count}</dd>

                    <dt className="text-muted mt-2 pt-2 border-t border-border">tokens in</dt>
                    <dd className="text-right mt-2 pt-2 border-t border-border">
                      {stats.tokens_input.toLocaleString()}
                    </dd>
                    <dt className="text-muted">tokens out</dt>
                    <dd className="text-right">{stats.tokens_output.toLocaleString()}</dd>
                    <dt className="text-muted font-semibold">total</dt>
                    <dd className="text-right font-semibold">
                      {stats.tokens_total.toLocaleString()}
                    </dd>

                    {stats.run_duration_seconds > 0 && (
                      <>
                        <dt className="text-muted mt-2 pt-2 border-t border-border">run time</dt>
                        <dd className="text-right mt-2 pt-2 border-t border-border">
                          {stats.run_duration_seconds.toFixed(2)}s
                        </dd>
                      </>
                    )}
                  </dl>

                  {stats.models_used.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted mb-1">
                        Models
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {stats.models_used.map((m) => (
                          <span
                            key={m}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-bg"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.themes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted mb-1">
                        Themes
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {stats.themes.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-border bg-bg"
                          >
                            {t}
                            {stats.theme_counts[t] != null && (
                              <span className="text-muted ml-1">·{stats.theme_counts[t]}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Observations */}
            {stats && stats.observations.length > 0 && (
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Observations · {stats.observation_count}
                </h4>
                <ul className="space-y-3">
                  {stats.observations.map((o) => (
                    <li key={o.Id} className="border border-border rounded-md p-3 bg-bg">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-[13px] leading-snug">{o.title}</p>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                            o.confidence === 'high'
                              ? 'border-fg text-fg'
                              : o.confidence === 'medium'
                                ? 'border-muted text-muted'
                                : 'border-border text-muted'
                          }`}
                        >
                          {o.confidence}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">{o.content}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] font-mono text-muted">
                          {o.type} · {o.domain}
                        </span>
                        {o.agent_name && (
                          <span className="text-[10px] font-mono text-muted">
                            · {o.agent_name}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Runs */}
            {stats && stats.runs.length > 0 && (
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Agent runs · {stats.run_count}
                </h4>
                <ul className="space-y-3">
                  {stats.runs.map((r) => (
                    <li key={r.Id} className="border border-border rounded-md p-3 bg-bg">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-[13px]">{r.agent_name}</p>
                        <span className="text-[10px] font-mono text-muted">{r.status}</span>
                      </div>
                      {r.summary && (
                        <p className="text-[11px] text-muted mb-2 leading-relaxed">
                          {r.summary}
                        </p>
                      )}
                      <dl className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] font-mono text-muted">
                        <dt>in</dt>
                        <dd className="col-span-2 text-fg">
                          {(r.tokens_input ?? 0).toLocaleString()}
                        </dd>
                        <dt>out</dt>
                        <dd className="col-span-2 text-fg">
                          {(r.tokens_output ?? 0).toLocaleString()}
                        </dd>
                        {r.context_tokens != null && (
                          <>
                            <dt>ctx</dt>
                            <dd className="col-span-2 text-fg">
                              {r.context_tokens.toLocaleString()}
                            </dd>
                          </>
                        )}
                        <dt>time</dt>
                        <dd className="col-span-2 text-fg">
                          {(r.duration_seconds ?? 0).toFixed(2)}s
                        </dd>
                        {r.model_name && (
                          <>
                            <dt>model</dt>
                            <dd className="col-span-2 text-fg truncate">{r.model_name}</dd>
                          </>
                        )}
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Outputs */}
            {stats && stats.outputs.length > 0 && (
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Outputs · {stats.output_count}
                </h4>
                <ul className="space-y-3">
                  {stats.outputs.map((o) => (
                    <li key={o.Id} className="border border-border rounded-md p-3 bg-bg">
                      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
                        {o.agent_name ?? `run #${o.run_id}`}
                      </p>
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                        {o.full_text}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

export const Route = createFileRoute('/chat')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: ChatPage,
});
