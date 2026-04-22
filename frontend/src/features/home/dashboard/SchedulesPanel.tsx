import type { Schedule } from '../../../api/home/types';
import { runSchedule } from '../../../api/home/mutations';
import { useToast } from '../../../lib/toast/useToast';
import { formatRelative } from '../../../lib/utils/formatRelative';

interface Props {
  schedules: Schedule[];
}

export function SchedulesPanel({ schedules }: Props) {
  const toast = useToast();

  async function handleRun(s: Schedule) {
    try {
      await runSchedule({ id: s.id });
      toast.success(`${s.agent_name} dispatched`);
    } catch (err) {
      toast.error(`Run failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="border border-border">
      <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted">
        Schedules
      </div>
      {schedules.length === 0 && <div className="p-3 text-[12px] text-muted">No schedules configured.</div>}
      <ul className="divide-y divide-border">
        {schedules.map((s) => (
          <li key={s.id} className={['p-3', s.active ? '' : 'opacity-50'].join(' ')}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] text-fg">{s.agent_name}</div>
                <div className="truncate text-[11px] text-muted">
                  {s.cron_expression} · {s.timezone}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">Next: {formatRelative(s.next_run_time)}</div>
              </div>
              <button
                className="border border-border px-2 py-1 text-[10px] uppercase tracking-[0.14em] hover:border-fg"
                onClick={() => void handleRun(s)}
              >
                Run now
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

