import { useEffect, useRef, useState } from 'react';
import { StatusChip } from '../components/StatusChip';
import type { ApiAuthType, ApiConnection } from '../types';

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

function endpointsCount(api: ApiConnection): number {
  const sample = api.inspection_summary_json?.openapi?.summary?.endpoints_sample;
  return sample ? sample.length : api.endpoints_count ?? 0;
}

function AuthChip({ type }: { type: ApiAuthType }) {
  const label =
    type === 'api_key_header'
      ? 'api_key (h)'
      : type === 'api_key_query'
        ? 'api_key (q)'
        : type;
  return (
    <span className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-mono border border-border rounded bg-panel">
      {label}
    </span>
  );
}

export function ApisList({
  apis,
  loading,
  error,
  onRetry,
  onRowClick,
  onDelete,
  onDuplicate,
}: {
  apis: ApiConnection[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRowClick: (api: ApiConnection) => void;
  onDelete: (api: ApiConnection) => void;
  onDuplicate: (api: ApiConnection) => void;
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
              <th className="py-2 pr-3 font-sans">Base URL</th>
              <th className="py-2 pr-3 font-sans">Auth</th>
              <th className="py-2 pr-3 font-sans">Status</th>
              <th className="py-2 pr-3 font-sans">Last verified</th>
              <th className="py-2 pr-3 font-sans">Endpoints</th>
              <th className="py-2 pr-3 font-sans">Tools</th>
              <th className="py-2 pr-3 font-sans w-8"></th>
            </tr>
          </thead>
          <tbody>
            {apis.map((api) => (
              <tr
                key={api.id}
                onClick={() => onRowClick(api)}
                className="border-t border-border cursor-pointer hover:bg-panelHi"
              >
                <td className="py-2 pr-3">
                  <div className="font-sans">{api.name}</div>
                  {api.description && (
                    <div className="text-[11px] text-muted truncate max-w-[24rem]">{api.description}</div>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-xs truncate max-w-[18rem]">{api.base_url}</td>
                <td className="py-2 pr-3">
                  <AuthChip type={api.auth_type} />
                </td>
                <td className="py-2 pr-3">
                  <StatusChip status={api.status} />
                </td>
                <td className="py-2 pr-3 text-xs font-mono" title={fmtAbsolute(api.verified_at)}>
                  {fmtRelative(api.verified_at)}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{endpointsCount(api)}</td>
                <td className="py-2 pr-3 font-mono text-xs">{api.used_by_agents?.length ?? 0}</td>
                <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                  <RowKebab
                    onEdit={() => onRowClick(api)}
                    onDuplicate={() => onDuplicate(api)}
                    onDelete={() => onDelete(api)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (<900px) */}
      <div className="block min-[900px]:hidden px-4 py-3 space-y-2">
        {apis.map((api) => (
          <button
            key={api.id}
            onClick={() => onRowClick(api)}
            className="block w-full text-left border border-border rounded-md px-3 py-2 hover:bg-panelHi"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-sans truncate">{api.name}</div>
              <StatusChip status={api.status} />
            </div>
            <div className="font-mono text-[11px] text-muted truncate">{api.base_url}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <AuthChip type={api.auth_type} />
              <span className="text-[11px] text-muted font-mono">
                {endpointsCount(api)} endpoints · {api.used_by_agents?.length ?? 0} tools
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function RowKebab({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Row actions"
        onClick={() => setOpen((s) => !s)}
        className="text-muted hover:text-fg px-2 py-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 border border-border bg-bg shadow-card min-w-[140px]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-panelHi"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-panelHi"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-panelHi text-red-700"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
