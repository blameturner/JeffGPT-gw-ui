// Tiny line-level diff viewer. Implements a naive LCS over lines and renders
// two side-by-side <pre> columns. On narrow screens the columns stack.

type Op = 'eq' | 'add' | 'del';
interface DiffLine {
  op: Op;
  before?: string;
  after?: string;
}

function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  // LCS length matrix.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 'eq', before: a[i], after: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: 'del', before: a[i] });
      i++;
    } else {
      out.push({ op: 'add', after: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ op: 'del', before: a[i++] });
  }
  while (j < m) {
    out.push({ op: 'add', after: b[j++] });
  }
  return out;
}

function splitLines(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(/\r?\n/);
}

export function DiffViewer({
  before,
  after,
}: {
  before?: string | null;
  after?: string | null;
}) {
  const a = splitLines(before);
  const b = splitLines(after);

  // Fallback for very disparate sizes — show two labelled blocks.
  if (
    (a.length > 2000 || b.length > 2000) ||
    (a.length === 0 && b.length === 0) ||
    Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.9 + 400
  ) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">Before</div>
          <pre className="bg-red-50 text-red-900 border border-border p-3 text-[11px] font-mono whitespace-pre-wrap overflow-auto max-h-[60vh]">
            {before ?? ''}
          </pre>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">After</div>
          <pre className="bg-emerald-50 text-emerald-900 border border-border p-3 text-[11px] font-mono whitespace-pre-wrap overflow-auto max-h-[60vh]">
            {after ?? ''}
          </pre>
        </div>
      </div>
    );
  }

  const diff = lcsDiff(a, b);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">Before</div>
        <pre className="border border-border bg-bg p-0 text-[11px] font-mono overflow-auto max-h-[60vh]">
          {diff.map((d, idx) => {
            if (d.op === 'add') {
              return (
                <div key={idx} className="px-2 py-[1px] opacity-30">
                  &nbsp;
                </div>
              );
            }
            const cls = d.op === 'del' ? 'bg-red-50 text-red-900' : '';
            return (
              <div key={idx} className={`px-2 py-[1px] ${cls}`}>
                {d.before ?? ''}
              </div>
            );
          })}
        </pre>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">After</div>
        <pre className="border border-border bg-bg p-0 text-[11px] font-mono overflow-auto max-h-[60vh]">
          {diff.map((d, idx) => {
            if (d.op === 'del') {
              return (
                <div key={idx} className="px-2 py-[1px] opacity-30">
                  &nbsp;
                </div>
              );
            }
            const cls = d.op === 'add' ? 'bg-emerald-50 text-emerald-900' : '';
            return (
              <div key={idx} className={`px-2 py-[1px] ${cls}`}>
                {d.after ?? ''}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
