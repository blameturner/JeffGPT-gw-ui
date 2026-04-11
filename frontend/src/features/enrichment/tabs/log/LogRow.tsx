import { useState } from 'react';
import type { EnrichmentLogEntry } from '../../../../api/types/EnrichmentLogEntry';
import { relTime } from '../../../../lib/utils/relTime';
import { parseLogMessage } from './parseLogMessage';
import { formatLogValue } from './formatLogValue';

export function LogRow({ row }: { row: EnrichmentLogEntry }) {
  const [open, setOpen] = useState(false);
  const parsed = parseLogMessage(row.message);

  // Headline shown collapsed: prefix sentence wins, else the first two pairs joined.
  const headline =
    parsed.prefix ||
    parsed.pairs
      .slice(0, 2)
      .map((p) => `${p.key}=${p.value}`)
      .join(' ') ||
    '—';

  const hasDetail =
    (parsed.prefix.length > 0 && parsed.pairs.length > 0) || parsed.pairs.length > 2;

  const highlight =
    row.event_type === 'deferred'
      ? 'bg-amber-50'
      : row.event_type === 'budget_exhausted'
        ? 'bg-red-50'
        : '';

  return (
    <div className={highlight}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={`w-full py-2 flex items-start gap-3 text-xs text-left ${
          hasDetail ? 'hover:bg-panelHi/50 cursor-pointer' : 'cursor-default'
        } transition-colors`}
      >
        <span className="font-sans text-muted w-20 shrink-0">{relTime(row.created_at)}</span>
        <span className="font-sans text-muted w-40 shrink-0">{row.event_type}</span>
        <span className="font-sans text-muted w-48 shrink-0 truncate">
          {row.source_url ?? '—'}
        </span>
        <span className="font-sans text-muted w-16 text-right shrink-0">
          {row.tokens_used != null ? `${row.tokens_used}t` : ''}
        </span>
        <span className="font-sans text-muted w-14 text-right shrink-0">
          {row.duration_seconds != null ? `${row.duration_seconds.toFixed(1)}s` : ''}
        </span>
        <span className="flex-1 text-fg truncate">{headline}</span>
        {row.flags && row.flags.length > 0 && (
          <span className="flex flex-wrap gap-1 shrink-0 max-w-[200px] justify-end">
            {row.flags.map((flag) => (
              <span
                key={flag}
                className="text-[9px] uppercase px-1 py-0.5 rounded border border-border text-muted"
              >
                {flag}
              </span>
            ))}
          </span>
        )}
        <span aria-hidden className="text-muted shrink-0 w-3 text-right">
          {hasDetail ? (open ? '▾' : '▸') : ''}
        </span>
      </button>
      {open && hasDetail && (
        <div className="px-3 pb-3 pt-1 border-l-2 border-border ml-2">
          {parsed.prefix && parsed.pairs.length > 0 && (
            <p className="text-[11px] text-muted mb-2">{parsed.prefix}</p>
          )}
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
            {parsed.pairs.map((p) => (
              <div key={p.key} className="contents">
                <dt className="text-muted">{p.key}</dt>
                <dd className="text-fg break-all font-mono whitespace-pre-wrap">
                  {formatLogValue(p.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

