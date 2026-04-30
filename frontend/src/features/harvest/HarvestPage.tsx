import { useEffect, useState } from 'react';
import { harvestApi, type HarvestPolicy, type HarvestRun } from '../../api/harvest';
import { PageHeader, TabRow, type TabDef } from '../../components/ui';
import { PolicyCatalog } from './PolicyCatalog';
import { TriggerForm } from './TriggerForm';
import { RunsTable } from './RunsTable';
import { HostsTable } from './HostsTable';
import { RunDetail } from './RunDetail';

type Tab = 'trigger' | 'runs' | 'hosts';

const TABS: ReadonlyArray<TabDef<Tab>> = [
  { id: 'trigger', label: 'Trigger' },
  { id: 'runs', label: 'Runs' },
  { id: 'hosts', label: 'Hosts' },
];

export function HarvestPage() {
  const [tab, setTab] = useState<Tab>('trigger');
  const [policies, setPolicies] = useState<HarvestPolicy[] | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<HarvestPolicy | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [activeRun, setActiveRun] = useState<HarvestRun | null>(null);

  useEffect(() => {
    harvestApi
      .policies()
      .then((r) => {
        setPolicies(r.policies);
        if (!selectedPolicy && r.policies.length) setSelectedPolicy(r.policies[0]);
      })
      .catch(() => setPolicies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTriggered = (runId: number) => {
    setActiveRunId(runId);
    setTab('runs');
  };

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Operator console"
        title="Harvest"
        right={
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted">
            {policies ? `${policies.length} policies` : 'loading'}
          </span>
        }
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[clamp(220px,16%,280px)_minmax(0,1fr)_clamp(320px,30%,440px)] divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
        <PolicyCatalog
          policies={policies}
          selected={selectedPolicy}
          onSelect={(p) => {
            setSelectedPolicy(p);
            setTab('trigger');
          }}
        />

        <div className="flex flex-col min-h-0 overflow-hidden">
          <TabRow tabs={TABS} active={tab} onChange={setTab} />
          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'trigger' && (
              <TriggerForm policy={selectedPolicy} onTriggered={onTriggered} />
            )}
            {tab === 'runs' && (
              <RunsTable
                onSelect={(r) => {
                  setActiveRunId(r.Id);
                  setActiveRun(r);
                }}
                activeRunId={activeRunId}
              />
            )}
            {tab === 'hosts' && <HostsTable />}
          </div>
        </div>

        <RunDetail
          runId={activeRunId}
          fallback={activeRun}
          policies={policies}
          onChanged={() => {
            // bump runs list refresh implicit via its own polling
          }}
          onOpenParent={(parentId) => setActiveRunId(parentId)}
        />
      </div>
    </div>
  );
}
