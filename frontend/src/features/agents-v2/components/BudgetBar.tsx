export function BudgetBar({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  max: number | null | undefined;
  unit?: string;
}) {
  const v = value ?? 0;
  const m = max ?? 0;
  const pct = m > 0 ? Math.min(100, (v / m) * 100) : 0;
  const tone = pct > 90 ? 'bg-red-600' : pct > 70 ? 'bg-amber-500' : 'bg-fg';
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">{label}</span>
        <span className="text-xs font-mono">
          {fmt(v)}
          {m > 0 && <span className="text-muted"> / {fmt(m)}</span>}
          {unit && <span className="text-muted ml-1">{unit}</span>}
        </span>
      </div>
      <div className="h-1.5 w-full bg-panelHi rounded">
        <div className={`h-full rounded ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}
