import { useState } from 'react';
import type { AgentRunEvent, AgentRunEventKind } from '../types';

function eventIcon(kind: AgentRunEventKind): string {
  switch (kind) {
    case 'run_start':
      return '⚑';
    case 'run_done':
      return '⚐';
    case 'llm_call':
      return 'LLM';
    case 'tool_ok':
      return 'tool';
    case 'tool_err':
      return 'tool!';
    case 'artifact_write':
      return '◫';
    case 'approval_queued':
      return '✋';
    case 'note':
      return '·';
    default:
      return '·';
  }
}

function iconClass(kind: AgentRunEventKind): string {
  if (kind === 'tool_err') return 'text-red-700';
  if (kind === 'run_done') return 'text-fg';
  if (kind === 'approval_queued') return 'text-amber-700';
  return 'text-muted';
}

function formatTime(iso?: string): string {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function summarise(ev: AgentRunEvent): string {
  if (ev.message) return ev.message;
  if (!ev.detail) return ev.kind;
  // Best-effort one-line summary from common shapes.
  const d = ev.detail;
  if (typeof d.summary === 'string') return d.summary;
  if (typeof d.tool === 'string') return `${ev.kind}: ${d.tool}`;
  if (typeof d.model === 'string') return `${ev.kind}: ${d.model}`;
  if (typeof d.path === 'string') return `${ev.kind}: ${d.path}`;
  try {
    const s = JSON.stringify(d);
    return s.length > 120 ? `${ev.kind}: ${s.slice(0, 117)}…` : `${ev.kind}: ${s}`;
  } catch {
    return ev.kind;
  }
}

function EventNode({ ev }: { ev: AgentRunEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex gap-3">
      <div className="shrink-0 w-16 text-[11px] font-mono text-muted pt-1">{formatTime(ev.ts)}</div>
      <div
        className={`shrink-0 w-10 text-[10px] font-mono uppercase tracking-wider pt-1 ${iconClass(ev.kind)}`}
      >
        {eventIcon(ev.kind)}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-left text-xs font-sans hover:text-fg w-full truncate"
        >
          {summarise(ev)}
        </button>
        {open && ev.detail && (
          <pre className="mt-2 text-[11px] font-mono bg-panel border border-border p-3 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(ev.detail, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

export function EventTimeline({ events }: { events: AgentRunEvent[] }) {
  if (!events?.length) {
    return <div className="text-xs text-muted">No events recorded.</div>;
  }
  return (
    <ol className="space-y-2 border-l border-border pl-3">
      {events.map((ev, i) => (
        <EventNode key={`${ev.ts}-${i}`} ev={ev} />
      ))}
    </ol>
  );
}
