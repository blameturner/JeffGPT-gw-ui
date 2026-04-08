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
import { ChatBubble } from '../components/ChatBubble';

type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
};


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

  // Stats panel — manual refresh only. Calls the harness summary endpoint
  // via the gateway; the panel is rendered inside the sidebar, and a full
  // detail overlay opens on demand for observations / runs / outputs.
  const [stats, setStats] = useState<ConversationSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsOverlay, setStatsOverlay] = useState(false);

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
    try {
      const res = await api.conversationMessages(c.Id);
      setMessages(
        res.messages
          .filter((m: ChatMessageRow) => m.role !== 'system')
          .map((m: ChatMessageRow) => ({
            id: String(m.Id),
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
      );
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load conversation');
    } finally {
      setLoadingMessages(false);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setStats(null);
    textareaRef.current?.focus();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !model) return;

    const userMsg: DisplayMessage = { id: uid(), role: 'user', content: text };
    const pendingMsg: DisplayMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      pending: true,
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await api.chat({
        model,
        message: text,
        conversation_id: activeId ?? undefined,
      });
      setMessages((m) =>
        m
          .filter((x) => x.id !== pendingMsg.id)
          .concat({ id: uid(), role: 'assistant', content: res.output }),
      );
      // First message in a brand-new conversation — capture the returned id
      // and refresh the sidebar so it appears.
      if (activeId == null) {
        setActiveId(res.conversation_id);
        try {
          const convRes = await api.conversations();
          setConversations(convRes.conversations);
        } catch {
          /* non-fatal */
        }
      }
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== pendingMsg.id));
      setError((err as Error)?.message ?? 'Send failed');
    } finally {
      setSending(false);
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
    <div className="h-screen flex bg-bg text-fg">
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

        {/* Stats panel — manual refresh only, never auto-hydrates. */}
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Conversation stats
            </span>
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

              {(stats.observation_count > 0 || stats.run_count > 0) && (
                <button
                  onClick={() => setStatsOverlay(true)}
                  className="mt-3 w-full text-[10px] uppercase tracking-[0.16em] font-mono text-fg border border-border rounded py-1.5 hover:bg-panelHi transition-colors"
                >
                  View details →
                </button>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-4 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">signed in</span>
          <button
            onClick={logout}
            className="text-xs font-medium text-fg hover:underline underline-offset-4"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ——— Details overlay ——— */}
      {statsOverlay && stats && (
        <div
          className="fixed inset-0 z-40 bg-fg/20 backdrop-blur-sm flex justify-end animate-fadeIn"
          onClick={() => setStatsOverlay(false)}
        >
          <aside
            className="w-[440px] max-w-full h-full bg-bg border-l border-border shadow-card overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 bg-bg/95 backdrop-blur px-6 py-5 border-b border-border flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                  Conversation details
                </p>
                <h3 className="font-display text-xl font-semibold tracking-tightest truncate">
                  {stats.conversation.title || 'Untitled'}
                </h3>
              </div>
              <button
                onClick={() => setStatsOverlay(false)}
                className="text-fg text-xl leading-none px-2 -mr-2 hover:opacity-60"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="px-6 py-5 space-y-6 text-sm">
              {/* Token breakdown */}
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Token breakdown
                </h4>
                <dl className="grid grid-cols-2 gap-y-1 text-[12px] font-mono">
                  <dt className="text-muted">messages in</dt>
                  <dd className="text-right">
                    {stats.tokens_breakdown.messages_input.toLocaleString()}
                  </dd>
                  <dt className="text-muted">messages out</dt>
                  <dd className="text-right">
                    {stats.tokens_breakdown.messages_output.toLocaleString()}
                  </dd>
                  <dt className="text-muted">runs in</dt>
                  <dd className="text-right">
                    {stats.tokens_breakdown.runs_input.toLocaleString()}
                  </dd>
                  <dt className="text-muted">runs out</dt>
                  <dd className="text-right">
                    {stats.tokens_breakdown.runs_output.toLocaleString()}
                  </dd>
                  <dt className="text-muted">runs context</dt>
                  <dd className="text-right">
                    {stats.tokens_breakdown.runs_context.toLocaleString()}
                  </dd>
                </dl>
              </section>

              {/* Roles */}
              {Object.keys(stats.role_counts).length > 0 && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                    Roles
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.role_counts).map(([role, count]) => (
                      <span
                        key={role}
                        className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-border"
                      >
                        {role} <span className="text-muted">·{count}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Observations */}
              {stats.observations.length > 0 && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                    Observations · {stats.observation_count}
                  </h4>
                  <ul className="space-y-3">
                    {stats.observations.map((o) => (
                      <li key={o.Id} className="border border-border rounded-md p-3 bg-panel/60">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-[14px] leading-snug">{o.title}</p>
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
                        <p className="text-[12px] text-muted leading-relaxed">{o.content}</p>
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
              {stats.runs.length > 0 && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                    Agent runs · {stats.run_count}
                  </h4>
                  <ul className="space-y-3">
                    {stats.runs.map((r) => (
                      <li key={r.Id} className="border border-border rounded-md p-3 bg-panel/60">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-[13px]">{r.agent_name}</p>
                          <span className="text-[10px] font-mono text-muted">
                            {r.status}
                          </span>
                        </div>
                        {r.summary && (
                          <p className="text-[12px] text-muted mb-2 leading-relaxed">
                            {r.summary}
                          </p>
                        )}
                        <dl className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] font-mono text-muted">
                          <dt>in</dt>
                          <dd className="col-span-2 text-fg">
                            {r.tokens_input.toLocaleString()}
                          </dd>
                          <dt>out</dt>
                          <dd className="col-span-2 text-fg">
                            {r.tokens_output.toLocaleString()}
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
                            {r.duration_seconds.toFixed(2)}s
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
              {stats.outputs.length > 0 && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                    Outputs · {stats.output_count}
                  </h4>
                  <ul className="space-y-3">
                    {stats.outputs.map((o) => (
                      <li key={o.Id} className="border border-border rounded-md p-3 bg-panel/60">
                        <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
                          {o.agent_name ?? `run #${o.run_id}`}
                        </p>
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap">
                          {o.full_text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}

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
          <div className="flex items-center gap-2 shrink-0">
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
                <ChatBubble key={m.id} message={m} pending={m.pending} />
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
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted mt-2 font-mono">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>
      </main>
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
