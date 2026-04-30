import { useCallback, useState } from 'react';
import { Btn, Empty, PageHeader } from '../../components/ui';
import { SimulationsList } from './SimulationsList';
import { SimulationComposer } from './SimulationComposer';

export function SimulationsPage() {
  const [prefillSample, setPrefillSample] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  const onEmptyChange = useCallback((empty: boolean) => setIsEmpty(empty), []);

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Rehearsal engine"
        title="Simulations"
        right={
          <Btn variant="ghost" size="sm" onClick={() => setPrefillSample(true)}>
            Try a sample
          </Btn>
        }
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[clamp(280px,33%,420px)_minmax(0,1fr)] divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
        <aside className="min-h-0 overflow-y-auto bg-panel/30">
          <div className="px-4 py-3 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted">
              Past runs
            </div>
          </div>
          <SimulationsList onEmptyChange={onEmptyChange} />
        </aside>

        <main className="min-h-0 overflow-y-auto">
          {isEmpty && (
            <div className="px-5 sm:px-6 pt-5">
              <Empty
                title="No rehearsals on record"
                hint="A simulation is a multi-agent rehearsal — set the scene, name the participants, watch it play out."
              >
                <Btn variant="secondary" size="sm" onClick={() => setPrefillSample(true)}>
                  Try a sample
                </Btn>
              </Empty>
            </div>
          )}
          <SimulationComposer
            prefillSample={prefillSample}
            onConsumedSample={() => setPrefillSample(false)}
          />
        </main>
      </div>
    </div>
  );
}
