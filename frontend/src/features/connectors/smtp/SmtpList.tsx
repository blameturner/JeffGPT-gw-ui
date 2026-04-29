import { StatusChip } from '../components/StatusChip';
import type { SmtpAccount } from '../types';

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}

function fmtAbsolute(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function tlsLabel(a: SmtpAccount): string {
  if (a.use_tls) return 'TLS';
  if (a.use_starttls) return 'STARTTLS';
  return 'none';
}

function TlsChip({ a }: { a: SmtpAccount }) {
  return (
    <span className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-mono border border-border rounded bg-panel">
      {tlsLabel(a)}
    </span>
  );
}

function ImapChip({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={[
        'inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-mono border border-border rounded',
        enabled ? 'bg-panel text-fg' : 'bg-panelHi text-muted',
      ].join(' ')}
    >
      IMAP {enabled ? 'yes' : 'no'}
    </span>
  );
}

export function SmtpList({
  accounts,
  loading,
  error,
  onRetry,
  onRowClick,
}: {
  accounts: SmtpAccount[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRowClick: (a: SmtpAccount) => void;
}) {
  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 bg-panel border border-border rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 rounded flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="text-[11px] uppercase tracking-[0.18em] font-sans border border-red-700 px-3 py-1.5 hover:bg-red-700 hover:text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table (>=900px) */}
      <div className="hidden min-[900px]:block px-4 sm:px-6 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-muted">
              <th className="py-2 pr-3 font-sans">Name</th>
              <th className="py-2 pr-3 font-sans">From</th>
              <th className="py-2 pr-3 font-sans">Host:Port</th>
              <th className="py-2 pr-3 font-sans">TLS</th>
              <th className="py-2 pr-3 font-sans">IMAP</th>
              <th className="py-2 pr-3 font-sans">Status</th>
              <th className="py-2 pr-3 font-sans">Verified</th>
              <th className="py-2 pr-3 font-sans">Used by</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.id}
                onClick={() => onRowClick(a)}
                className="border-t border-border cursor-pointer hover:bg-panelHi"
              >
                <td className="py-2 pr-3">
                  <div className="font-sans">{a.name}</div>
                  {a.description && (
                    <div className="text-[11px] text-muted truncate max-w-[24rem]">
                      {a.description}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-xs truncate max-w-[16rem]">
                  {a.from_email}
                </td>
                <td className="py-2 pr-3 font-mono text-xs truncate max-w-[16rem]">
                  {a.host}:{a.port}
                </td>
                <td className="py-2 pr-3">
                  <TlsChip a={a} />
                </td>
                <td className="py-2 pr-3">
                  <ImapChip enabled={Boolean(a.imap_enabled)} />
                </td>
                <td className="py-2 pr-3">
                  <StatusChip status={a.status} />
                </td>
                <td
                  className="py-2 pr-3 text-xs font-mono"
                  title={fmtAbsolute(a.verified_at)}
                >
                  {fmtRelative(a.verified_at)}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {a.used_by_agents?.length ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (<900px) */}
      <div className="block min-[900px]:hidden px-4 py-3 space-y-2">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => onRowClick(a)}
            className="block w-full text-left border border-border rounded-md px-3 py-2 hover:bg-panelHi"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-sans truncate">{a.name}</div>
              <StatusChip status={a.status} />
            </div>
            <div className="font-mono text-[11px] text-muted truncate">
              {a.from_email} · {a.host}:{a.port}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <TlsChip a={a} />
              <ImapChip enabled={Boolean(a.imap_enabled)} />
              <span
                className="text-[11px] text-muted font-mono"
                title={fmtAbsolute(a.verified_at)}
              >
                {fmtRelative(a.verified_at)} · {a.used_by_agents?.length ?? 0} used
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
