import { useEffect, useRef, useState } from 'react';

export function UsagePromptEditor({
  value,
  onChange,
  onRegenerate,
  regenerating,
  flash,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  flash?: boolean;
  disabled?: boolean;
}) {
  const [highlight, setHighlight] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!flash) return;
    setHighlight(true);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlight(false), 1100);
    return () => clearTimeout(t);
  }, [flash]);

  const charCount = value?.length ?? 0;
  const tokens = Math.round(charCount / 4); // rough estimate

  return (
    <div className="space-y-2">
      <div className="rounded bg-panel border border-border px-3 py-2 text-[11px] text-muted">
        This text is fed verbatim into every agent prompt that uses this API. Keep it accurate.
      </div>
      <textarea
        ref={ref}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        spellCheck={false}
        disabled={disabled}
        className={[
          'w-full border bg-bg font-mono text-xs leading-5 px-3 py-2 transition-colors',
          highlight ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-border focus:border-fg',
          'focus:outline-none disabled:opacity-60',
        ].join(' ')}
      />
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted font-mono">
          {charCount.toLocaleString()} chars · ~{tokens.toLocaleString()} tokens
        </div>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating || disabled}
            className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border px-3 py-2 hover:border-fg hover:text-fg transition-colors disabled:opacity-50"
          >
            {regenerating ? 'Inspecting…' : 'Re-generate from inspection'}
          </button>
        )}
      </div>
    </div>
  );
}
