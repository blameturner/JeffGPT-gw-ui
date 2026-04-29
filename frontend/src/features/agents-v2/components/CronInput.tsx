import { useMemo } from 'react';
import { TextInput } from '../../connectors/components/Field';

// Tiny cron parser supporting only `* / , -` and digits across the 5 standard
// fields: minute hour day-of-month month day-of-week. Returns the next 5 fire
// times starting from `from`. If parsing fails, returns null.

type FieldRange = { min: number; max: number };

const FIELD_RANGES: FieldRange[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day-of-month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day-of-week (0=Sun)
];

function parseField(raw: string, range: FieldRange): number[] | null {
  const parts = raw.split(',');
  const out = new Set<number>();
  for (const p of parts) {
    const slashIx = p.indexOf('/');
    let base = p;
    let step = 1;
    if (slashIx >= 0) {
      base = p.slice(0, slashIx);
      const stepStr = p.slice(slashIx + 1);
      const stepN = Number(stepStr);
      if (!Number.isFinite(stepN) || stepN <= 0) return null;
      step = stepN;
    }
    let lo = range.min;
    let hi = range.max;
    if (base === '*' || base === '') {
      // full range
    } else if (base.includes('-')) {
      const [a, b] = base.split('-');
      const an = Number(a);
      const bn = Number(b);
      if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
      lo = an;
      hi = bn;
    } else {
      const n = Number(base);
      if (!Number.isFinite(n)) return null;
      if (slashIx >= 0) {
        lo = n;
        hi = range.max;
      } else {
        lo = n;
        hi = n;
      }
    }
    if (lo < range.min || hi > range.max || lo > hi) return null;
    for (let i = lo; i <= hi; i += step) out.add(i);
  }
  return Array.from(out).sort((a, b) => a - b);
}

function nextFires(expr: string, from: Date, count: number): Date[] | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const sets: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const s = parseField(fields[i], FIELD_RANGES[i]);
    if (!s || s.length === 0) return null;
    sets.push(s);
  }
  const [mins, hours, doms, months, dows] = sets;
  const out: Date[] = [];
  const cur = new Date(from.getTime());
  cur.setSeconds(0, 0);
  cur.setMinutes(cur.getMinutes() + 1);
  // brute search up to ~2 years
  const limit = 60 * 24 * 366 * 2;
  let steps = 0;
  while (out.length < count && steps < limit) {
    if (
      mins.includes(cur.getMinutes()) &&
      hours.includes(cur.getHours()) &&
      months.includes(cur.getMonth() + 1) &&
      doms.includes(cur.getDate()) &&
      dows.includes(cur.getDay())
    ) {
      out.push(new Date(cur.getTime()));
    }
    cur.setMinutes(cur.getMinutes() + 1);
    steps++;
  }
  return out.length > 0 ? out : null;
}

export function CronInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const fires = useMemo(() => {
    if (!value) return null;
    try {
      return nextFires(value, new Date(), 5);
    } catch {
      return null;
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <TextInput
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '0 9 * * 1-5'}
        className="font-mono"
      />
      <div className="border border-border bg-panel p-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">
          Next 5 fires
        </div>
        {!value ? (
          <div className="text-xs text-muted">Enter a cron expression.</div>
        ) : fires == null ? (
          <div className="text-xs text-red-700">
            Couldn&apos;t parse — make sure it has 5 fields.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {fires.map((d, i) => (
              <li key={i} className="text-xs font-mono text-muted">
                {d.toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
