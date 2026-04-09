import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type CodeFilePayload, type LlmModel } from '../lib/api';
import { authClient } from '../lib/auth-client';

type Mode = 'plan' | 'execute' | 'debug';

interface CodeMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: Mode;
  content: string;
  status: 'complete' | 'streaming' | 'error';
  errorMessage?: string;
}

interface AttachedFile {
  name: string;
  content_b64: string;
  size: number;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function extractCodeBlocks(md: string): Array<{ lang: string; code: string }> {
  const out: Array<{ lang: string; code: string }> = [];
  const re = /```([\w+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    out.push({ lang: m[1] || 'text', code: m[2] });
  }
  return out;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function CodePage() {
  const [models, setModels] = useState<LlmModel[]>([]);
  const [model, setModel] = useState<string>('');
  const [mode, setMode] = useState<Mode>('plan');
  const [approvedPlan, setApprovedPlan] = useState<string | null>(null);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [messages, setMessages] = useState<CodeMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.models();
        if (cancelled) return;
        setModels(res.models);
        if (res.models[0]) setModel(res.models[0].name);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.message ?? 'Failed to load models');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => streamAbortRef.current?.abort(), []);

  async function onFilesPicked(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const encoded: AttachedFile[] = [];
    for (const f of picked) {
      try {
        const b64 = await fileToBase64(f);
        encoded.push({ name: f.name, content_b64: b64, size: f.size });
      } catch (err) {
        console.error('[code] file encode failed', f.name, err);
      }
    }
    setFiles((prev) => [...prev, ...encoded]);
    e.target.value = '';
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function approvePlan(m: CodeMessage) {
    setApprovedPlan(m.content);
    setMode('execute');
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !model) return;

    const userMsg: CodeMessage = {
      id: uid(),
      role: 'user',
      mode,
      content: text,
      status: 'complete',
    };
    const pendingId = uid();
    const pendingMsg: CodeMessage = {
      id: pendingId,
      role: 'assistant',
      mode,
      content: '',
      status: 'streaming',
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput('');
    setSending(true);
    setError(null);

    const payloadFiles: CodeFilePayload[] = files.map((f) => ({
      name: f.name,
      content_b64: f.content_b64,
    }));
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const stream = api.codeStream(
        {
          model,
          message: text,
          mode,
          approved_plan: mode === 'execute' ? approvedPlan : null,
          files: payloadFiles.length > 0 ? payloadFiles : undefined,
        },
        controller.signal,
      );

      for await (const ev of stream) {
        if (ev.type === 'chunk') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId ? { ...x, content: x.content + ev.text } : x,
            ),
          );
        } else if (ev.type === 'done') {
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, status: 'complete' } : x)),
          );
        } else if (ev.type === 'error') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'error', errorMessage: ev.message }
                : x,
            ),
          );
          setError(ev.message);
          break;
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
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const codeBlocks = lastAssistant ? extractCodeBlocks(lastAssistant.content) : [];

  return (
    <div className="h-full flex bg-bg text-fg">
      <div className="flex-1 flex flex-col border-r border-border min-w-0">
        <header className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code worker</p>
            <h2 className="font-display text-xl font-semibold tracking-tightest">
              Plan / Run / Debug
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="bg-bg border border-border px-3 py-1.5 rounded-md text-sm font-mono focus:outline-none focus:border-fg"
            >
              <option value="plan">Plan</option>
              <option value="execute">Execute</option>
              <option value="debug">Debug</option>
            </select>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-bg border border-border px-3 py-1.5 rounded-md text-sm font-mono focus:outline-none focus:border-fg"
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

        {approvedPlan && (
          <div className="border-b border-border px-6 py-2 bg-panel/40 flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted">
              Plan approved - will be injected on next run turn
            </span>
            <button
              onClick={() => setApprovedPlan(null)}
              className="text-[10px] uppercase tracking-[0.14em] text-fg hover:underline underline-offset-4"
            >
              Clear
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.length === 0 ? (
            <div className="pt-16 text-center">
              <p className="font-display text-3xl font-semibold tracking-tightest">
                Describe the task.
              </p>
              <p className="text-muted text-sm mt-3 font-mono">
                Plan first / approve / run
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={[
                    'max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed',
                    m.role === 'user'
                      ? 'bg-fg text-bg rounded-br-sm whitespace-pre-wrap'
                      : 'bg-panel border border-border text-fg rounded-bl-sm markdown-body',
                  ].join(' ')}
                >
                  <div className="text-[9px] uppercase tracking-[0.16em] font-mono text-muted mb-1">
                    {m.mode}
                  </div>
                  {m.role === 'user' ? (
                    m.content
                  ) : m.status === 'error' ? (
                    <span className="text-red-600 font-mono text-[12px]">
                      {m.errorMessage || 'Request failed'}
                    </span>
                  ) : (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      {m.mode === 'plan' && m.status === 'complete' && (
                        <button
                          onClick={() => approvePlan(m)}
                          className="mt-3 text-[11px] uppercase tracking-[0.14em] font-mono border border-fg px-3 py-1 rounded hover:bg-fg hover:text-bg transition-colors"
                        >
                          Approve plan
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="px-6 pb-2">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="border-t border-border px-6 py-4">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f) => (
                <span
                  key={f.name}
                  className="text-[11px] font-mono px-2 py-1 rounded border border-border bg-panel/60 flex items-center gap-2"
                >
                  {f.name}
                  <span className="text-muted">({f.size}b)</span>
                  <button
                    onClick={() => removeFile(f.name)}
                    className="text-muted hover:text-fg"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3 border border-border rounded-xl bg-panel/40 focus-within:border-fg px-4 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={model ? `Describe the ${mode} task...` : 'Load a model to start'}
              disabled={!model || sending}
              className="flex-1 bg-transparent resize-none outline-none text-[14px] leading-relaxed placeholder:text-muted disabled:opacity-50"
            />
            <label className="shrink-0 text-[10px] uppercase tracking-[0.14em] font-mono text-muted border border-border rounded px-2 py-1.5 cursor-pointer hover:border-fg hover:text-fg">
              + Files
              <input
                type="file"
                multiple
                onChange={onFilesPicked}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!model || !input.trim() || sending}
              className="shrink-0 px-4 py-2 rounded-md bg-fg text-bg text-sm font-medium hover:bg-fg/85 disabled:opacity-40"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      <div className="w-1/2 max-w-[720px] flex flex-col bg-panel/20">
        <header className="border-b border-border px-6 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code output</p>
          <h3 className="font-display text-lg font-semibold tracking-tightest">
            {codeBlocks.length > 0
              ? `${codeBlocks.length} block${codeBlocks.length === 1 ? '' : 's'}`
              : 'No code yet'}
          </h3>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {codeBlocks.length === 0 ? (
            <p className="text-muted text-sm font-mono">
              Code blocks from the latest assistant message will appear here.
            </p>
          ) : (
            codeBlocks.map((b, i) => (
              <div key={i} className="border border-border rounded-md overflow-hidden">
                <div className="px-3 py-1.5 bg-panel/60 border-b border-border text-[10px] uppercase tracking-[0.14em] font-mono text-muted flex items-center justify-between">
                  <span>{b.lang}</span>
                  <button
                    onClick={() => void navigator.clipboard.writeText(b.code)}
                    className="hover:text-fg"
                  >
                    Copy
                  </button>
                </div>
                <pre className="font-mono text-[12px] leading-relaxed p-3 overflow-x-auto whitespace-pre bg-bg">
                  <code className={`language-${b.lang}`}>{b.code}</code>
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/code')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: CodePage,
});