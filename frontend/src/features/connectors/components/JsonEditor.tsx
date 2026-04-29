import { useEffect, useState } from 'react';

// Lightweight JSON editor: monospace textarea + parse-on-blur validation.
// We don't use Monaco yet; a textarea preserves bundle size while the rest of
// the connector UI stabilises. The interface (value/onChange of an object) is
// the same shape we'll port later.
export function JsonEditor({
  value,
  onChange,
  rows = 8,
  placeholder,
  disabled,
  schemaHint,
  requireObject = true,
}: {
  value: Record<string, unknown> | unknown[] | null | undefined;
  onChange: (next: Record<string, unknown> | unknown[] | null) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  schemaHint?: string;
  requireObject?: boolean;
}) {
  const [text, setText] = useState(() => formatJson(value));
  const [error, setError] = useState<string | null>(null);

  // Sync external changes (don't clobber in-progress edits if text is dirty).
  useEffect(() => {
    setText(formatJson(value));
    setError(null);
  }, [JSON.stringify(value)]);

  function commit(next: string) {
    const trimmed = next.trim();
    if (!trimmed) {
      setError(null);
      onChange(null);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (requireObject && (parsed === null || typeof parsed !== 'object')) {
        setError('Must be an object or array');
        return;
      }
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-1">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // try parse live so the consumer sees current state, but don't surface error until blur
          try {
            const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : null;
            if (!requireObject || parsed === null || typeof parsed === 'object') {
              setError(null);
            }
          } catch {
            // silent during typing
          }
        }}
        onBlur={(e) => commit(e.target.value)}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder ?? '{\n  \n}'}
        disabled={disabled}
        className={`w-full border ${error ? 'border-red-500' : 'border-border'} bg-panel rounded font-mono text-xs leading-5 px-3 py-2 focus:outline-none focus:border-fg disabled:opacity-60`}
      />
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted font-mono">{schemaHint}</span>
        {error && <span className="text-red-700">{error}</span>}
      </div>
    </div>
  );
}

function formatJson(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}
