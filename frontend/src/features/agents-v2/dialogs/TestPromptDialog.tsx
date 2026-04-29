import { useState } from 'react';
import { Modal } from '../../connectors/components/Modal';
import { Field, TextArea } from '../../connectors/components/Field';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';
import { runAgentNow, testPrompt } from '../api';
import type { Agent, TestPromptResult } from '../types';
import { DiffViewer } from '../components/DiffViewer';

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Collapsible({
  title,
  children,
  initialOpen = false,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  initialOpen?: boolean;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <section className="border border-border">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-panel">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] uppercase tracking-[0.14em] font-sans text-fg flex items-center gap-2"
        >
          <span className="font-mono text-muted">{open ? '▾' : '▸'}</span>
          {title}
        </button>
        <div className="flex items-center gap-2">{actions}</div>
      </header>
      {open && <div className="p-0">{children}</div>}
    </section>
  );
}

export function TestPromptDialog({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const [task, setTask] = useState<string>(agent.brief ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestPromptResult | null>(null);
  const [renderMode, setRenderMode] = useState<'render' | 'raw'>('render');
  const [runningReal, setRunningReal] = useState(false);
  const [realQueued, setRealQueued] = useState<number | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await testPrompt(agent.Id, { task });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test prompt failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runForReal() {
    setRunningReal(true);
    setError(null);
    try {
      const r = await runAgentNow(agent.Id, { task });
      setRealQueued(r.assignment_id);
      // Close after a brief moment so the user can see the confirmation toast.
      setTimeout(() => onClose(), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue run.');
    } finally {
      setRunningReal(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Test prompt: ${agent.name}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <GhostButton type="button" onClick={onClose}>
            Close
          </GhostButton>
          <div className="flex items-center gap-2">
            {realQueued != null && (
              <span className="text-xs font-mono text-emerald-700">Queued #{realQueued}</span>
            )}
            <SecondaryButton
              type="button"
              disabled={!result || runningReal}
              onClick={runForReal}
            >
              {runningReal ? 'Queuing…' : 'Looks good — run for real'}
            </SecondaryButton>
            <PrimaryButton type="submit" form="test-prompt-form" disabled={busy}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3 w-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                  Running…
                </span>
              ) : (
                'Run in test mode'
              )}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <form id="test-prompt-form" onSubmit={run} className="space-y-4">
        <Field label="Task">
          <TextArea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={5}
            placeholder="Describe the test task"
          />
        </Field>
        {error && (
          <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs">
            {error}
          </div>
        )}
      </form>

      {result && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-4 text-xs font-mono text-muted">
            <span>tokens_in: {result.tokens_in ?? '—'}</span>
            <span>tokens_out: {result.tokens_out ?? '—'}</span>
            <span>duration: {result.duration_ms != null ? `${result.duration_ms} ms` : '—'}</span>
          </div>

          <Collapsible
            title="prompt_snapshot"
            actions={<CopyButton text={result.prompt_snapshot} />}
          >
            <pre className="text-[11px] font-mono p-3 bg-panel max-h-72 overflow-auto whitespace-pre-wrap">
              {result.prompt_snapshot}
            </pre>
          </Collapsible>

          <section className="border border-border">
            <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-panel">
              <span className="text-[11px] uppercase tracking-[0.14em] font-sans">Output</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRenderMode('render')}
                  className={`text-[10px] uppercase tracking-[0.18em] px-2 py-1 ${
                    renderMode === 'render' ? 'text-fg border-b border-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  Render
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMode('raw')}
                  className={`text-[10px] uppercase tracking-[0.18em] px-2 py-1 ${
                    renderMode === 'raw' ? 'text-fg border-b border-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  Raw
                </button>
                <CopyButton text={result.output} />
              </div>
            </header>
            {renderMode === 'render' ? (
              <div className="p-3 text-sm whitespace-pre-wrap font-sans max-h-96 overflow-auto">
                {result.output}
              </div>
            ) : (
              <pre className="p-3 text-[11px] font-mono whitespace-pre-wrap max-h-96 overflow-auto">
                {result.output}
              </pre>
            )}
          </section>

          {result.output_diff && (
            <section className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">output_diff</div>
              <DiffViewer
                before={result.output_diff.before}
                after={result.output_diff.after}
              />
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
