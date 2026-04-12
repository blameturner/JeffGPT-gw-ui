import { useState } from 'react';
import type { AttachedFile } from './types/AttachedFile';
import type { CodeBlock } from './types/CodeBlock';
import { b64ToUtf8 } from './utils/b64ToUtf8';
import { downloadBlob } from './utils/downloadBlob';
import { DiffView } from './DiffView';
import { ShikiBlock } from './ShikiBlock';

export function CodeBlockCard({
  block,
  workspace,
  onRun,
}: {
  block: CodeBlock;
  workspace: AttachedFile[];
  onRun?: (code: string) => Promise<string>;
}) {
  const [showDiff, setShowDiff] = useState(true);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string | null>(null);

  const existing = block.file
    ? workspace.find((w) => w.name === block.file || w.name.endsWith('/' + block.file))
    : undefined;
  const existingText = existing?.content ?? (existing ? b64ToUtf8(existing.content_b64) : '');
  const saveName = block.file ?? `snippet.${block.lang === 'text' ? 'txt' : block.lang}`;

  async function copyBlock() {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  async function runBlock() {
    if (!onRun) return;
    setRunning(true);
    setRunOutput(null);
    try {
      const out = await onRun(block.code);
      setRunOutput(out || '(no output)');
    } catch (err) {
      setRunOutput(`Run failed: ${(err as Error)?.message ?? 'unknown'}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-panel/60 border-b border-border text-[10px] uppercase tracking-[0.14em] font-sans text-muted flex items-center justify-between gap-2">
        <span className="truncate">
          {block.file ? (
            <>
              <span className="text-fg">{block.file}</span>
              <span className="ml-2">· {block.lang}</span>
            </>
          ) : (
            block.lang
          )}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {existing && (
            <button onClick={() => setShowDiff((d) => !d)} className="hover:text-fg">
              {showDiff ? 'Raw' : 'Diff'}
            </button>
          )}
          {onRun && (
            <button
              onClick={() => void runBlock()}
              disabled={running}
              className="hover:text-fg disabled:opacity-50 disabled:hover:text-muted"
              title="Run in sandbox"
            >
              {running ? 'Running…' : 'Run'}
            </button>
          )}
          <button onClick={() => void copyBlock()} className="hover:text-fg">
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={() => downloadBlob(saveName, block.code)} className="hover:text-fg">
            Save
          </button>
        </div>
      </div>
      {existing && showDiff ? (
        <DiffView before={existingText} after={block.code} />
      ) : (
        <ShikiBlock code={block.code} lang={block.lang} />
      )}
      {runOutput != null && (
        <pre className="font-mono text-[11.5px] bg-bg border-t border-border p-3 whitespace-pre-wrap max-h-64 overflow-auto">
          {runOutput}
        </pre>
      )}
    </div>
  );
}
