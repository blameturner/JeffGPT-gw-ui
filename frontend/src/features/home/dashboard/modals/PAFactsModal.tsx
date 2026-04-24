import { useEffect, useMemo, useState } from 'react';
import type { PAFact } from '../../../../api/home/types';
import { listFacts, deleteFact } from '../../../../api/home/facts';
import { formatRelative } from '../../../../lib/utils/formatRelative';
import { useToast } from '../../../../lib/toast/useToast';
import { ModalShell } from './ModalShell';

interface Props {
  onClose: () => void;
}

export function PAFactsModal({ onClose }: Props) {
  const [facts, setFacts] = useState<PAFact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    listFacts()
      .then((r) => setFacts(r.facts))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const grouped = useMemo(() => {
    const g = new Map<string, PAFact[]>();
    for (const f of facts) {
      const k = f.kind || 'other';
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(f);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [facts]);

  async function handleForget(fact: PAFact) {
    const ok = window.confirm(
      `Forget this fact?\n\n${fact.key}: ${fact.value}\n\nThe PA will lose this detail.`,
    );
    if (!ok) return;
    setBusyId(fact.Id);
    try {
      await deleteFact(fact.Id);
      setFacts((fs) => fs.filter((f) => f.Id !== fact.Id));
      toast.success('Forgotten.');
    } catch (err) {
      toast.error(`Couldn't forget: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModalShell title="What the PA knows about me" onClose={onClose}>
      {!loaded && (
        <div className="text-sm italic font-display text-muted">Loading…</div>
      )}
      {loaded && facts.length === 0 && (
        <div className="py-10 text-center">
          <p className="font-display italic text-muted">
            The PA hasn't learned anything persistent yet.
          </p>
        </div>
      )}
      {loaded && facts.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([kind, rows]) => (
            <section key={kind}>
              <div className="flex items-baseline gap-2 pb-1.5">
                <span className="text-[10px] uppercase tracking-[0.22em] font-sans text-muted">
                  {kind}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="divide-y divide-border">
                {rows.map((f) => (
                  <li
                    key={f.Id}
                    className="py-2.5 flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-sans">
                        <span className="text-muted">{f.key}</span>
                        <span className="mx-2 text-muted">·</span>
                        <span className="text-fg">{f.value}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
                        confidence{' '}
                        <span className="tabular-nums">
                          {Math.round((f.confidence ?? 0) * 100)}%
                        </span>
                        {f.last_seen_at && (
                          <>
                            {' '}
                            · last seen {formatRelative(f.last_seen_at)}
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === f.Id}
                      onClick={() => void handleForget(f)}
                      className="shrink-0 border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:border-fg hover:text-fg disabled:opacity-50"
                    >
                      {busyId === f.Id ? '…' : 'Forget'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
