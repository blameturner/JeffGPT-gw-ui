import { useState } from 'react';

export function TestResultCard({
  statusCode,
  statusText,
  durationMs,
  headers,
  body,
}: {
  statusCode: number;
  statusText?: string;
  durationMs: number;
  headers: Record<string, string>;
  body: unknown;
}) {
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBody, setShowBody] = useState(true);

  const tone = statusCode >= 500 ? 'red' : statusCode >= 400 ? 'amber' : 'emerald';
  const toneClass =
    tone === 'red'
      ? 'bg-red-50 text-red-800'
      : tone === 'amber'
        ? 'bg-yellow-50 text-yellow-800'
        : 'bg-emerald-50 text-emerald-800';

  const bodyText =
    typeof body === 'string'
      ? body
      : (() => {
          try {
            return JSON.stringify(body, null, 2);
          } catch {
            return String(body);
          }
        })();

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
        <span className={`px-2 py-0.5 rounded text-xs font-mono ${toneClass}`}>
          {statusCode} {statusText}
        </span>
        <span className="text-xs text-muted font-mono">{durationMs} ms</span>
      </div>

      <button
        type="button"
        onClick={() => setShowHeaders((s) => !s)}
        className="w-full text-left px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg border-b border-border"
      >
        {showHeaders ? '▾' : '▸'} Headers ({Object.keys(headers).length})
      </button>
      {showHeaders && (
        <pre className="px-4 py-2 text-[11px] font-mono whitespace-pre-wrap break-words bg-panel border-b border-border max-h-64 overflow-auto">
          {Object.entries(headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n')}
        </pre>
      )}

      <button
        type="button"
        onClick={() => setShowBody((s) => !s)}
        className="w-full text-left px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
      >
        {showBody ? '▾' : '▸'} Body
      </button>
      {showBody && (
        <pre className="px-4 py-3 text-[11px] font-mono whitespace-pre-wrap break-words bg-panel max-h-96 overflow-auto">
          {bodyText}
        </pre>
      )}
    </div>
  );
}
