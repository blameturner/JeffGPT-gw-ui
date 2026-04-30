import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  isSimTerminal,
  simulationsApi,
  type Sim,
} from '../../api/simulations';
import {
  Btn,
  Drawer,
  Eyebrow,
  PageHeader,
  StatusPill,
  TabRow,
  type TabDef,
} from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';
import { speakerColor } from './speakerColor';
import { Transcript } from './Transcript';
import { Debrief } from './Debrief';

type Tab = 'transcript' | 'debrief';

const TABS: ReadonlyArray<TabDef<Tab>> = [
  { id: 'transcript', label: 'Transcript' },
  { id: 'debrief', label: 'Debrief' },
];

export function SimulationDetailPage({ simId }: { simId: number }) {
  const navigate = useNavigate();
  const [sim, setSim] = useState<Sim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('transcript');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const simRef = useRef<Sim | null>(null);
  simRef.current = sim;

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      simulationsApi
        .get(simId)
        .then((r) => {
          if (cancelled) return;
          setSim(r);
          setError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(String((e as Error)?.message ?? e));
        });

    void load();
    const timer = setInterval(() => {
      const current = simRef.current;
      if (current && isSimTerminal(current.status)) return;
      void load();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [simId]);

  // When the run flips to completed and the user is still on Transcript, keep
  // them there — they may want to scroll back. Auto-jump to Debrief only on
  // the very first terminal flip while still on Transcript? Skip — surprises
  // are worse than a single click.

  const cancel = async () => {
    if (!sim) return;
    setCancelling(true);
    try {
      await simulationsApi.cancel(sim.sim_id);
      await navigate({ to: '/simulations' });
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  if (!sim) {
    return (
      <div className="h-full flex flex-col bg-bg text-fg font-sans">
        <PageHeader eyebrow="Simulation" title={`#${simId}`} />
        <div className="flex-1 grid place-items-center text-[11px] uppercase tracking-[0.18em] text-muted">
          {error ?? 'Loading…'}
        </div>
      </div>
    );
  }

  const inFlight = !isSimTerminal(sim.status);
  const turns = sim.transcript ?? [];

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <button
              onClick={() => navigate({ to: '/simulations' })}
              className="hover:text-fg transition-colors"
            >
              Simulations
            </button>
            <span>·</span>
            <span>#{sim.sim_id}</span>
          </span>
        }
        title={sim.title || `Simulation #${sim.sim_id}`}
        right={
          <>
            <StatusPill status={sim.status} />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted hidden sm:inline">
              {relTime(sim.started_at ?? null)}
            </span>
            <Btn variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
              Details
            </Btn>
            {inFlight && (
              <Btn variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
                Cancel
              </Btn>
            )}
          </>
        }
      />

      <TabRow tabs={TABS} active={tab} onChange={setTab} />

      {error && (
        <div className="px-4 py-2 text-[11px] text-red-700 bg-red-50 border-b border-red-200">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0">
        {tab === 'transcript' ? (
          <Transcript
            turns={turns}
            participants={sim.participants ?? []}
            status={sim.status}
          />
        ) : (
          <Debrief debrief={sim.debrief} status={sim.status} />
        )}
      </div>

      <Drawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        eyebrow="Simulation"
        title={sim.title || `#${sim.sim_id}`}
        meta={`#${sim.sim_id} · ${sim.max_turns} max turns`}
      >
        <div className="space-y-5 text-sm">
          <section>
            <Eyebrow className="mb-1.5">Scenario</Eyebrow>
            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed bg-panel/50 border border-border rounded-sm px-3 py-2.5">
              {sim.scenario}
            </pre>
          </section>

          <section>
            <Eyebrow className="mb-1.5">Participants</Eyebrow>
            <ul className="space-y-2">
              {(sim.participants ?? []).map((p) => {
                const c = speakerColor(p.name);
                return (
                  <li
                    key={p.name}
                    className="border border-border rounded-sm p-3"
                    style={{ background: c.wash + '55' }}
                  >
                    <div
                      className="text-[10px] uppercase tracking-[0.18em] inline-block px-1.5 py-0.5 rounded-sm border mb-1.5"
                      style={{ color: c.ink, background: c.wash, borderColor: c.border }}
                    >
                      {p.name}
                    </div>
                    <div className="text-[13px] leading-relaxed font-mono text-fg/90">
                      {p.persona}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="text-[11px] text-muted space-y-1">
            <div>
              <span className="uppercase tracking-[0.18em]">Started</span> ·{' '}
              {sim.started_at ? new Date(sim.started_at).toLocaleString() : '—'}
            </div>
            {sim.completed_at && (
              <div>
                <span className="uppercase tracking-[0.18em]">Completed</span> ·{' '}
                {new Date(sim.completed_at).toLocaleString()}
              </div>
            )}
          </section>

          {sim.error && (
            <section>
              <Eyebrow className="mb-1.5">Error</Eyebrow>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed bg-red-50 border border-red-200 text-red-800 rounded-sm px-3 py-2.5">
                {sim.error}
              </pre>
            </section>
          )}
        </div>
      </Drawer>

      {confirmCancel && (
        <ConfirmCancelDialog
          busy={cancelling}
          onConfirm={() => void cancel()}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </div>
  );
}

function ConfirmCancelDialog({
  busy,
  onConfirm,
  onClose,
}: {
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-fg/15 backdrop-blur-[1px] animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative bg-bg border border-border rounded-sm shadow-card max-w-sm w-[90%] p-5 animate-fadeIn">
        <div className="font-display text-lg tracking-tightest">
          Cancel this simulation?
        </div>
        <p className="text-xs text-muted mt-1">
          The current turn will finish, then the run stops. The transcript so far
          stays on record.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Keep running
          </Btn>
          <Btn variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel run'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
