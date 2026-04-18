// frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import type { PipelineSummary } from '../../../../../api/types/PipelineSummary';
import type { QueueStatus } from '../../../../../api/types/QueueStatus';
import { PipelineCard } from './PipelineCard';
import { fmt } from '../lib/formatters';

export interface PipelineRibbonProps {
  pipeline?: PipelineSummary;
  runtime?: OpsDashboardResponse['runtime'];
  backoff?: QueueStatus['backoff'];
  triggersDisabled?: boolean;
  busy?: 'scraper' | 'pathfinder' | 'discover' | null;
  onKick: (kind: 'scraper' | 'pathfinder' | 'discover') => void;
}

export function PipelineRibbon({
  pipeline,
  runtime,
  backoff,
  triggersDisabled,
  busy,
  onKick,
}: PipelineRibbonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <PipelineCard
        kind="scraper"
        config={pipeline?.config?.scraper}
        schedule={pipeline?.schedule?.scraper}
        lastJob={pipeline?.last_jobs?.scraper}
        disabled={triggersDisabled}
        busy={busy === 'scraper'}
        onKick={() => onKick('scraper')}
      />
      <PipelineCard
        kind="pathfinder"
        config={pipeline?.config?.pathfinder}
        schedule={pipeline?.schedule?.pathfinder}
        lastJob={pipeline?.last_jobs?.pathfinder}
        disabled={triggersDisabled}
        busy={busy === 'pathfinder'}
        onKick={() => onKick('pathfinder')}
      />
      <PipelineCard
        kind="discover_agent"
        config={pipeline?.config?.discover_agent}
        schedule={pipeline?.schedule?.discover_agent}
        lastJob={pipeline?.last_jobs?.discover_agent}
        disabled={triggersDisabled}
        busy={busy === 'discover'}
        onKick={() => onKick('discover')}
      />

      <div className="border border-border rounded p-3 space-y-2 min-w-[14rem]">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Queue and Huey</p>
        <p className="text-sm">tool_queue_ready: {fmt(runtime?.tool_queue_ready)}</p>
        <p className="text-sm">consumer: {runtime?.huey?.consumer_running ? 'running' : 'stopped'}</p>
        <p className="text-sm">workers: {fmt(runtime?.huey?.workers)}</p>
        <p className="text-sm">backoff: {fmt(backoff?.state)}</p>
        <p className="text-[11px] text-muted">idle: {fmt(backoff?.idle_seconds)}s</p>
      </div>
    </div>
  );
}
