import { useEffect, useRef, useState } from 'react';
import type { Secret, SecretKind } from '../types';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  const suffix = future ? 'from now' : 'ago';
  if (sec < 60) return `${sec}s ${suffix}`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ${suffix}`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ${suffix}`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day}d ${suffix}`;
  const mo = Math.round(day / 30);
  return `${mo}mo ${suffix}`;
}

function fmtAbsolute(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function expiryClass(iso: string | null | undefined): string {
  if (!iso) return 'text-muted';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'text-muted';
  const diff = t - Date.now();
  if (diff < 0) return 'text-red-700';
  if (diff < FOURTEEN_DAYS_MS) return 'text-amber-700';
  return 'text-fg';
}

function KindChip({ kind }: { kind: SecretKind }) {
  return (
    <span
      aria-label={`Secret kind ${kind}`}
      className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-mono border border-border rounded bg-panel"
    >
      {kind}
    </span>
  );
}

export function SecretsList({
  secrets,
  loading,
  error,
  onRetry,
  onRowClick,
  onEdit,
  onRotate,
  onDelete,
}: {
  secrets: Secret[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRowClick: (secret: Secret) => void;
  onEdit?: (secret: Secret) => void;
  onRotate?: (secret: Secret) => void;
  onDelete?: (secret: Secret) => void;
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
              <th className="py-2 pr-3 font-sans">Kind</th>
              <th className="py-2 pr-3 font-sans">Description</th>
              <th className="py-2 pr-3 font-sans">Length</th>
              <th className="py-2 pr-3 font-sans">Expires</th>
              <th className="py-2 pr-3 font-sans">Last rotated</th>
              <th className="py-2 pr-3 font-sans w-8"></th>
            </tr>
          </thead>
          <tbody>
            {secrets.map((secret) => (
              <tr
                key={secret.id}
                onClick={() => onRowClick(secret)}
                className="border-t border-border cursor-pointer hover:bg-panelHi"
              >
                <td className="py-2 pr-3">
                  <div className="font-mono text-xs">{secret.name}</div>
                  <div className="font-mono text-[11px] text-muted select-none">••••••••</div>
                </td>
                <td className="py-2 pr-3">
                  <KindChip kind={secret.kind} />
                </td>
                <td className="py-2 pr-3 text-xs text-muted truncate max-w-[20rem]">
                  {secret.description || <span className="text-muted">—</span>}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {secret.value_length != null ? `${secret.value_length} chars` : '—'}
                </td>
                <td
                  className={['py-2 pr-3 text-xs font-mono', expiryClass(secret.expires_at)].join(' ')}
                  title={fmtAbsolute(secret.expires_at)}
                >
                  {secret.expires_at ? fmtRelative(secret.expires_at) : '—'}
                </td>
                <td className="py-2 pr-3 text-xs font-mono" title={fmtAbsolute(secret.rotated_at)}>
                  {fmtRelative(secret.rotated_at)}
                </td>
                <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                  <RowKebab
                    onEdit={() => (onEdit ? onEdit(secret) : onRowClick(secret))}
                    onRotate={() => (onRotate ? onRotate(secret) : onRowClick(secret))}
                    onDelete={() => (onDelete ? onDelete(secret) : onRowClick(secret))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (<900px) */}
      <div className="block min-[900px]:hidden px-4 py-3 space-y-2">
        {secrets.map((secret) => (
          <button
            key={secret.id}
            onClick={() => onRowClick(secret)}
            className="block w-full text-left border border-border rounded-md px-3 py-2 hover:bg-panelHi"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-sm truncate">{secret.name}</div>
              <KindChip kind={secret.kind} />
            </div>
            <div className="font-mono text-[11px] text-muted select-none">••••••••</div>
            {secret.description && (
              <div className="text-[11px] text-muted truncate mt-1">{secret.description}</div>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono">
              <span className="text-muted">
                {secret.value_length != null ? `${secret.value_length} chars` : '—'}
              </span>
              <span className="text-muted">·</span>
              <span className={expiryClass(secret.expires_at)} title={fmtAbsolute(secret.expires_at)}>
                {secret.expires_at ? `expires ${fmtRelative(secret.expires_at)}` : 'no expiry'}
              </span>
              <span className="text-muted">·</span>
              <span className="text-muted" title={fmtAbsolute(secret.rotated_at)}>
                rotated {fmtRelative(secret.rotated_at)}
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
  onRotate,
  onDelete,
}: {
  onEdit: () => void;
  onRotate: () => void;
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
              onRotate();
            }}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-panelHi"
          >
            Rotate
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
