import type { AgentApproval } from '../types';
import { PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.floor(diff)} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function PayloadBody({ kind, payload }: { kind: string; payload: Record<string, unknown> }) {
  if (kind === 'reply_email') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[80px_1fr] gap-y-1 text-sm">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">From</div>
          <div className="font-mono text-xs">{asString(payload.from)}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">To</div>
          <div className="font-mono text-xs">{asString(payload.to)}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
            Subject
          </div>
          <div className="font-mono text-xs">{asString(payload.subject)}</div>
        </div>
        <pre className="whitespace-pre-wrap break-words bg-panel border border-border p-3 font-mono text-xs">
          {asString(payload.body)}
        </pre>
      </div>
    );
  }

  if (kind === 'http_post' || kind === 'http_put' || kind === 'http_delete') {
    const method = kind.replace('http_', '').toUpperCase();
    const headers = asRecord(payload.headers);
    return (
      <div className="space-y-2 text-sm">
        <div className="font-mono text-xs">
          <span className="font-display uppercase">{method}</span>{' '}
          <span className="break-all">{asString(payload.url)}</span>
        </div>
        {headers && (
          <pre className="bg-panel border border-border p-3 font-mono text-xs overflow-auto">
            {JSON.stringify(headers, null, 2)}
          </pre>
        )}
        {payload.body !== undefined && (
          <pre className="bg-panel border border-border p-3 font-mono text-xs overflow-auto">
            {typeof payload.body === 'string'
              ? payload.body
              : JSON.stringify(payload.body, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (kind === 'nocodb_insert' || kind === 'nocodb_update') {
    const data = asRecord(payload.payload) ?? asRecord(payload.row) ?? {};
    return (
      <div className="space-y-2 text-sm">
        <div className="font-mono text-xs">
          <span className="text-muted uppercase tracking-[0.14em]">Table:</span>{' '}
          {asString(payload.table)}
        </div>
        <div className="bg-panel border border-border p-3 font-mono text-xs space-y-1">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[160px_1fr] gap-2">
              <span className="font-bold">{k}</span>
              <span className="break-all whitespace-pre-wrap">
                {typeof v === 'string' ? v : JSON.stringify(v)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <pre className="bg-panel border border-border p-3 font-mono text-xs overflow-auto">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  focused,
  onFocus,
}: {
  approval: AgentApproval;
  onApprove: () => void;
  onReject: () => void;
  focused?: boolean;
  onFocus?: () => void;
}) {
  return (
    <article
      tabIndex={0}
      onFocus={onFocus}
      data-approval-id={approval.Id}
      className={`bg-bg ${focused ? 'border-2 border-fg' : 'border border-border'} focus:outline-none`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <a
          href={`/agents?id=${approval.agent_id}`}
          className="font-display text-sm hover:underline"
        >
          {approval.agent_name ?? `Agent #${approval.agent_id}`}
        </a>
        <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
          {approval.action_kind}
        </span>
        <span className="text-xs text-muted font-mono ml-auto">{relTime(approval.created_at)}</span>
        <a
          href={`/agents?id=${approval.agent_id}&assignment=${approval.assignment_id}`}
          className="text-xs text-muted hover:text-fg font-mono"
        >
          #{approval.assignment_id}
        </a>
      </header>
      <div className="p-4">
        <PayloadBody kind={approval.action_kind} payload={approval.action_payload_json} />
      </div>
      <footer className="flex justify-end gap-2 border-t border-border px-4 py-2">
        <SecondaryButton onClick={onReject}>Reject</SecondaryButton>
        <PrimaryButton onClick={onApprove}>Approve &amp; run</PrimaryButton>
      </footer>
    </article>
  );
}
