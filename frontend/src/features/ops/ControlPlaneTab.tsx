import { useEffect, useRef, useState } from 'react';
import { HTTPError } from '../../lib/http';
import {
  adminApi,
  queueEventStreamUrl,
  type AdminQueueBackoff,
  type AdminRuntimeResponse,
  type AdminRuntimeRow,
  type TriggerSchemaField,
  type TriggerSchemaResponse,
} from '../../api/admin';
import { getQueueDashboard } from '../../api/queue/getQueueDashboard';
import { retryQueueJob } from '../../api/queue/retryQueueJob';
import { cancelQueueJob } from '../../api/queue/cancelQueueJob';
import { defaultOrgId } from '../../api/home/config';
import { http } from '../../lib/http';
import type { QueueEvent } from '../../api/types/QueueEvent';
import type { QueueJob } from '../../api/types/QueueJob';
import { Btn, Drawer, Empty, Eyebrow, Field, StatusPill, TextInput } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

const POLL_MS = 5000;
const TICKER_MAX = 60;

interface TickerEntry {
  id: string;
  ts: number;
  text: string;
  tone: 'queued' | 'dispatched' | 'completed' | 'failed' | 'cancelled';
}

export function ControlPlaneTab() {
  const [data, setData] = useState<AdminRuntimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [triggerSchema, setTriggerSchema] = useState<TriggerSchemaResponse | null>(null);
  const [triggerErrors, setTriggerErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      adminApi
        .runtime()
        .then((r) => {
          if (cancelled) return;
          setData(r);
          setError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(String((e as Error)?.message ?? e));
        });
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash((cur) => (cur === msg ? null : cur)), 4000);
  };

  const onRunNow = async (row: AdminRuntimeRow) => {
    setBusy(row.id);
    try {
      const schema = await adminApi.triggerSchema(row.id).catch(() => null);
      if (schema && schema.required.length > 0) {
        setTriggerSchema(schema);
        return; // drawer takes over
      }
      const r = await adminApi.trigger(row.id);
      showFlash(`Queued ${row.label} · ${r.job_id.slice(0, 8)}`);
    } catch (e) {
      setError(await formatError(e));
    } finally {
      setBusy(null);
    }
  };

  const onSubmitTrigger = async (payload: Record<string, unknown>) => {
    if (!triggerSchema) return;
    const id = triggerSchema.subsystem;
    setBusy(id);
    setTriggerErrors({});
    try {
      const r = await adminApi.trigger(id, { payload });
      showFlash(`Queued ${triggerSchema.label} · ${r.job_id.slice(0, 8)}`);
      setTriggerSchema(null);
    } catch (e) {
      const errs = await extractFieldErrors(e);
      if (errs) setTriggerErrors(errs);
      else setError(await formatError(e));
    } finally {
      setBusy(null);
    }
  };

  const onToggle = async (row: AdminRuntimeRow) => {
    setBusy(row.id);
    try {
      const enabled = row.enabled !== false;
      const fn = enabled ? adminApi.disable : adminApi.enable;
      const r = await fn(row.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              subsystems: prev.subsystems.map((s) =>
                s.id === row.id ? { ...s, enabled: r.enabled } : s,
              ),
            }
          : prev,
      );
      showFlash(`${row.label} ${r.enabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setError(await formatError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-5 space-y-6">
      <BackoffBanner backoff={data?.queue?.backoff ?? null} />
      <PulseStrip data={data} />

      {flash && (
        <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">
          {flash}
        </div>
      )}
      {error && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded flex items-start justify-between gap-2">
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="text-red-700/70 hover:text-red-700">×</button>
        </div>
      )}

      <RunningNowPanel />

      <RecentFailuresPanel />

      <SystemControls onFlash={showFlash} onError={(e) => setError(e)} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {data === null
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : data.subsystems.length === 0
            ? <div className="col-span-full"><Empty title="no subsystems registered" /></div>
            : data.subsystems.map((s) => (
                <SubsystemCard
                  key={s.id}
                  row={s}
                  busy={busy === s.id}
                  onTrigger={() => void onRunNow(s)}
                  onToggle={() => void onToggle(s)}
                />
              ))}
      </div>

      <EventTicker />

      <TriggerDrawer
        schema={triggerSchema}
        errors={triggerErrors}
        busy={busy === triggerSchema?.subsystem}
        onClose={() => {
          setTriggerSchema(null);
          setTriggerErrors({});
        }}
        onSubmit={onSubmitTrigger}
      />
    </div>
  );
}

async function formatError(e: unknown): Promise<string> {
  if (e instanceof HTTPError) {
    try {
      const body = (await e.response.clone().json()) as { detail?: unknown };
      const detail = body.detail;
      if (typeof detail === 'string') return detail;
      if (detail && typeof detail === 'object' && 'errors' in detail) {
        const errs = (detail as { errors?: unknown }).errors;
        if (Array.isArray(errs)) return errs.map((x) => String(x)).join('; ');
      }
      return JSON.stringify(detail ?? body);
    } catch {
      return e.message;
    }
  }
  return String((e as Error)?.message ?? e);
}

async function extractFieldErrors(e: unknown): Promise<Record<string, string> | null> {
  if (!(e instanceof HTTPError)) return null;
  try {
    const body = (await e.response.clone().json()) as { detail?: unknown };
    const detail = body.detail;
    if (!detail || typeof detail !== 'object') return null;
    const errs = (detail as { errors?: unknown }).errors;
    if (!Array.isArray(errs)) return null;
    const out: Record<string, string> = {};
    for (const item of errs) {
      if (typeof item === 'string') {
        out._global = (out._global ? `${out._global}; ` : '') + item;
      } else if (item && typeof item === 'object' && 'field' in item && 'message' in item) {
        const r = item as { field: string; message: string };
        out[r.field] = r.message;
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function BackoffBanner({ backoff }: { backoff: AdminQueueBackoff | null }) {
  if (!backoff) return null;
  if (backoff.state === 'chat_active' || backoff.chat_active) {
    return (
      <div className="border border-sky-300 bg-sky-50 rounded-md px-4 py-3 flex items-start gap-3">
        <span className="mt-1 w-2 h-2 rounded-full bg-sky-500 animate-pulse shrink-0" />
        <div className="text-xs text-sky-900 leading-relaxed">
          <strong className="block text-[11px] uppercase tracking-[0.18em] text-sky-700 mb-0.5">
            Queue paused — chat session live
          </strong>
          Background workers won't claim new jobs while a chat turn is streaming. Anything
          already running will finish; nothing new starts. The queue resumes{' '}
          {backoff.threshold ?? 120}s after the turn closes.
        </div>
      </div>
    );
  }
  if (backoff.state === 'waiting_for_idle') {
    const remaining =
      backoff.threshold != null && backoff.idle_seconds != null
        ? Math.max(0, backoff.threshold - backoff.idle_seconds)
        : backoff.remaining_s ?? null;
    return (
      <div className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2.5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
        <span className="text-xs text-amber-900">
          Cooling down after a chat turn —
          {remaining != null ? ` resuming in ~${Math.ceil(remaining)}s.` : ' resuming shortly.'}
        </span>
      </div>
    );
  }
  return null;
}

function PulseStrip({ data }: { data: AdminRuntimeResponse | null }) {
  const huey = data?.huey;
  const queue = data?.queue;
  const scheduler = data?.scheduler;

  const hueyTone = !huey
    ? 'neutral'
    : huey.consumer_running === false || huey.consumer_healthy === false
      ? 'error'
      : huey.workers != null && huey.active_workers === huey.workers
        ? 'warn'
        : 'success';
  const hueyLabel = !huey
    ? 'huey: …'
    : huey.consumer_running === false
      ? 'huey: stopped'
      : `huey: ${huey.active_workers ?? 0}/${huey.workers ?? 0} workers`;

  const backoff = queue?.backoff;
  const idleTone =
    !backoff
      ? 'neutral'
      : backoff.state === 'chat_active'
        ? 'warn'
        : backoff.state === 'waiting_for_idle'
          ? 'warn'
          : 'success';
  const idleLabel = (() => {
    if (!backoff) return 'queue: …';
    if (backoff.state === 'chat_active') return 'queue: paused (chat live)';
    if (backoff.state === 'waiting_for_idle') {
      const r =
        backoff.threshold != null && backoff.idle_seconds != null
          ? Math.max(0, backoff.threshold - backoff.idle_seconds)
          : backoff.remaining_s;
      return `queue: cooling${r != null ? ` ${Math.ceil(r)}s` : ''}`;
    }
    return 'queue: ready';
  })();

  const total = queue?.total ?? 0;
  const queued = queue?.by_status?.queued ?? 0;
  const running = queue?.by_status?.running ?? 0;

  return (
    <div className="flex items-center gap-3 flex-wrap text-[11px] uppercase tracking-[0.18em]">
      <StatusPill status={hueyLabel} tone={hueyTone}>{hueyLabel}</StatusPill>
      <StatusPill status={idleLabel} tone={idleTone}>{idleLabel}</StatusPill>
      <span className="text-muted">
        {total} total · <span className="text-fg/70">{queued} queued</span>
        {' · '}
        <span className={running > 0 ? 'text-sky-700' : 'text-muted'}>{running} running</span>
      </span>
      {scheduler?.next_fire_at && (
        <span className="text-muted">next scheduled: {relTime(scheduler.next_fire_at)}</span>
      )}
    </div>
  );
}

function RunningNowPanel() {
  const [jobs, setJobs] = useState<QueueJob[] | null>(null);
  const [showQueued, setShowQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getQueueDashboard({ org_id: defaultOrgId(), limit: 50 })
        .then((r) => {
          if (cancelled) return;
          setJobs(r.recent_jobs ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setJobs([]);
        });
    void load();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const running = (jobs ?? []).filter((j) => j.status === 'running');
  const queued = (jobs ?? [])
    .filter((j) => j.status === 'queued')
    .sort((a, b) => (b.priority ?? 3) - (a.priority ?? 3));
  const visible = showQueued ? [...running, ...queued] : running;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>
          {showQueued ? `In flight & queued (${running.length} + ${queued.length})` : `Running now (${running.length})`}
        </Eyebrow>
        <button
          onClick={() => setShowQueued((v) => !v)}
          className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg"
        >
          {showQueued ? 'hide queued' : `show queued (${queued.length})`}
        </button>
      </div>
      {jobs == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="border border-border rounded-md bg-panel/30 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted">
          {showQueued
            ? 'queue is empty'
            : running.length === 0 && queued.length > 0
              ? `nothing running · ${queued.length} queued`
              : 'idle'}
        </div>
      ) : (
        <ul className="border border-border rounded-md bg-bg divide-y divide-border/60 overflow-hidden">
          {visible.map((j) => (
            <RunningJobRow key={j.job_id} job={j} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RunningJobRow({ job }: { job: QueueJob }) {
  const isRunning = job.status === 'running';
  const ageSeconds = (() => {
    const ts = isRunning ? job.started_at : job.created_at || job.started_at;
    if (!ts) return null;
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 1000));
  })();
  const tone = isRunning ? 'bg-sky-500 animate-pulse' : 'bg-muted';
  const summary = job.task || job.title || job.url || '';

  return (
    <li className="px-3 py-2 flex items-baseline gap-3 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone}`} />
      <span className="font-mono text-[11px] text-fg/85 shrink-0 w-44 truncate" title={job.type}>
        {job.type}
      </span>
      <span className="font-mono text-[10px] text-muted shrink-0 w-16">
        {job.job_id.slice(0, 8)}
      </span>
      <span className="font-mono text-[10px] text-muted shrink-0 w-14 text-right">
        {ageSeconds != null ? formatAge(ageSeconds) : '—'}
      </span>
      {isRunning ? null : (
        <span className="font-mono text-[10px] text-muted shrink-0 w-12 text-right">
          p{job.priority ?? 3}
        </span>
      )}
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted shrink-0 w-24 truncate">
        {job.source || (isInteractive(job.source) ? 'chat' : 'background')}
      </span>
      <span className="truncate text-fg/80 flex-1" title={summary}>
        {summary}
      </span>
    </li>
  );
}

function formatAge(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60) ? ` ${Math.floor((s % 3600) / 60)}m` : ''}`;
}

function isInteractive(source: string | undefined): boolean {
  const s = (source || '').toLowerCase();
  return s === 'chat' || s === 'code' || s.startsWith('chat_') || s.startsWith('code_');
}

function RecentFailuresPanel() {
  const [jobs, setJobs] = useState<QueueJob[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getQueueDashboard({ org_id: defaultOrgId(), limit: 100 })
        .then((r) => {
          if (cancelled) return;
          const failed = (r.recent_jobs ?? [])
            .filter((j) => j.status === 'failed')
            .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
            .slice(0, 12);
          setJobs(failed);
        })
        .catch(() => {
          if (cancelled) return;
          setJobs([]);
        });
    void load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pulse]);

  const retry = async (id: string) => {
    setBusy(id);
    try {
      await retryQueueJob(id);
      setPulse((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };
  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await cancelQueueJob(id);
      setPulse((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };

  if (jobs == null) return null;
  if (jobs.length === 0) {
    return (
      <section>
        <Eyebrow className="mb-2">Recent failures (24h)</Eyebrow>
        <div className="border border-border rounded-md bg-emerald-50/30 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-emerald-800/80">
          ✓ no failures recorded
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Recent failures ({jobs.length})</Eyebrow>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">retry · cancel</span>
      </div>
      <ul className="border border-border rounded-md bg-bg divide-y divide-border/60 overflow-hidden">
        {jobs.map((j) => (
          <li key={j.job_id} className="px-3 py-2 flex items-baseline gap-3 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <span className="font-mono text-[11px] text-fg/85 shrink-0 w-44 truncate" title={j.type}>
              {j.type}
            </span>
            <span className="font-mono text-[10px] text-muted shrink-0 w-16">
              {j.job_id.slice(0, 8)}
            </span>
            <span className="font-mono text-[10px] text-muted shrink-0 w-20 text-right">
              {j.completed_at ? relTime(j.completed_at) : '—'}
            </span>
            <span className="text-red-700/90 truncate flex-1" title={j.error || ''}>
              {j.error || '(no error message)'}
            </span>
            <div className="shrink-0 inline-flex gap-1">
              <button
                onClick={() => void retry(j.job_id)}
                disabled={busy === j.job_id}
                className="px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] border border-border rounded-sm text-fg hover:border-fg disabled:opacity-50"
              >
                Retry
              </button>
              <button
                onClick={() => void cancel(j.job_id)}
                disabled={busy === j.job_id}
                className="px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] border border-border rounded-sm text-muted hover:text-fg hover:border-fg disabled:opacity-50"
              >
                Hide
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SystemControls({
  onFlash,
  onError,
}: {
  onFlash: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const dropCaches = async () => {
    setBusy('caches');
    try {
      const r = await http
        .post('api/home/caches/drop', { json: {} })
        .json<{ status: string; dropped: string[] }>();
      onFlash(`Dropped: ${r.dropped.join(', ') || 'nothing'}`);
    } catch (e) {
      onError(`Cache drop failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>System controls</Eyebrow>
      </div>
      <div className="border border-border rounded-md bg-bg divide-y divide-border/60">
        <ControlRow
          label="Drop chat caches"
          desc="Clears PA recall, digest preface, and graph entity-name caches. The next chat turn pays the full cold-load cost. Use after a manual NocoDB edit."
          action={
            <Btn size="sm" variant="primary" onClick={() => void dropCaches()} disabled={busy === 'caches'}>
              {busy === 'caches' ? 'Dropping…' : 'Drop'}
            </Btn>
          }
        />
      </div>
    </section>
  );
}

function ControlRow({
  label,
  desc,
  action,
}: {
  label: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm tracking-tightest leading-tight">{label}</div>
        <p className="text-[11px] text-muted leading-relaxed mt-0.5">{desc}</p>
      </div>
      <div className="shrink-0 flex items-center gap-2">{action}</div>
    </div>
  );
}

function SubsystemCard({
  row,
  busy,
  onTrigger,
  onToggle,
}: {
  row: AdminRuntimeRow;
  busy: boolean;
  onTrigger: () => void;
  onToggle: () => void;
}) {
  const inFlight = row.in_flight ?? (row.queued ?? 0) + (row.running ?? 0);
  const enabled = row.enabled !== false;
  const togglable = !!row.feature_section;
  const lastTone = row.last_run_status === 'failed'
    ? 'text-red-700'
    : row.last_run_status === 'completed'
      ? 'text-emerald-700'
      : 'text-muted';

  return (
    <div className="border border-border rounded-md bg-bg p-4 flex flex-col gap-3 hover:border-fg/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-[15px] tracking-tightest leading-tight truncate">
            {row.label}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono mt-0.5">
            {row.id}
          </div>
        </div>
        {togglable ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            title={enabled ? 'Click to disable' : 'Click to enable'}
            className="shrink-0 disabled:opacity-50"
          >
            <StatusPill
              status={enabled ? 'enabled' : 'disabled'}
              tone={enabled ? 'success' : 'neutral'}
            >
              {enabled ? 'enabled' : 'disabled'}
            </StatusPill>
          </button>
        ) : (
          <StatusPill status="active" tone="neutral">on demand</StatusPill>
        )}
      </div>

      <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
        <dt className="text-muted">in flight</dt>
        <dd className="font-mono">
          {inFlight}
          {(row.queued != null || row.running != null) && (
            <span className="text-muted"> ({row.queued ?? 0} queued, {row.running ?? 0} running)</span>
          )}
        </dd>
        <dt className="text-muted">last run</dt>
        <dd className={`font-mono ${lastTone}`}>
          {row.last_run_at ? `${relTime(row.last_run_at)} — ${row.last_run_status ?? 'unknown'}` : '—'}
        </dd>
        <dt className="text-muted">24h</dt>
        <dd className="font-mono">
          <span className="text-emerald-700">✓ {row.completed_24h ?? 0}</span>
          <span className="text-muted"> · </span>
          <span className={row.failed_24h ? 'text-red-700' : 'text-muted'}>✗ {row.failed_24h ?? 0}</span>
        </dd>
        {row.next_scheduled_at && (
          <>
            <dt className="text-muted">next</dt>
            <dd className="font-mono text-muted">
              {row.next_scheduled_label ? `${row.next_scheduled_label} · ` : ''}
              {relTime(row.next_scheduled_at)}
            </dd>
          </>
        )}
        {row.last_run_error && (
          <>
            <dt className="text-muted">error</dt>
            <dd className="text-red-700 truncate" title={row.last_run_error}>
              {row.last_run_error}
            </dd>
          </>
        )}
      </dl>

      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/60">
        <Btn
          size="sm"
          variant="primary"
          disabled={busy || row.supports_trigger === false}
          onClick={onTrigger}
        >
          {busy ? 'Triggering…' : 'Run now'}
        </Btn>
      </div>
    </div>
  );
}

function TriggerDrawer({
  schema,
  errors,
  busy,
  onClose,
  onSubmit,
}: {
  schema: TriggerSchemaResponse | null;
  errors: Record<string, string>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!schema) return;
    const initial: Record<string, unknown> = {};
    for (const f of [...schema.required, ...schema.optional]) {
      if (f.default !== undefined) initial[f.name] = f.default;
    }
    setValues(initial);
  }, [schema]);

  if (!schema) return null;

  const fields = [...schema.required, ...schema.optional];
  const requiredNames = new Set(schema.required.map((f) => f.name));

  const submit = () => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (v === undefined || v === '' || v === null) continue;
      payload[f.name] = v;
    }
    onSubmit(payload);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-md"
      eyebrow="Run now"
      title={schema.label}
      meta={schema.trigger_job_type}
      actions={
        <>
          <Btn variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Run now'}
          </Btn>
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
        </>
      }
    >
      {schema.description && (
        <p className="text-xs text-muted mb-4">{schema.description}</p>
      )}
      {errors._global && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-1.5 rounded mb-3">
          {errors._global}
        </div>
      )}
      {fields.length === 0 ? (
        <p className="text-xs text-muted">No parameters required.</p>
      ) : (
        <div className="space-y-3">
          {fields.map((f) => (
            <SchemaFieldInput
              key={f.name}
              field={f}
              required={requiredNames.has(f.name)}
              value={values[f.name]}
              error={errors[f.name]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

function SchemaFieldInput({
  field,
  required,
  value,
  error,
  onChange,
}: {
  field: TriggerSchemaField;
  required: boolean;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <span>
      {field.name}
      {required && <span className="text-red-700 ml-1">*</span>}
    </span>
  );
  const hint = error ? <span className="text-red-700">{error}</span> : field.description;

  if (field.type === 'boolean') {
    return (
      <Field label={label} hint={hint}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-muted">{value ? 'true' : 'false'}</span>
        </label>
      </Field>
    );
  }

  if (field.type === 'enum' && field.options) {
    return (
      <Field label={label} hint={hint}>
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full bg-bg border border-border rounded-sm px-2.5 py-1.5 text-sm focus:outline-none focus:border-fg"
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={String(o)} value={String(o)}>{String(o)}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === 'number' || field.type === 'integer') {
    return (
      <Field label={label} hint={hint}>
        <TextInput
          type="number"
          mono
          min={field.min}
          max={field.max}
          step={field.type === 'integer' ? 1 : undefined}
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') return onChange(undefined);
            const n = field.type === 'integer' ? parseInt(v, 10) : parseFloat(v);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
        />
      </Field>
    );
  }

  // string, array, object → text input (object/array as JSON)
  const isJson = field.type === 'array' || field.type === 'object';
  return (
    <Field label={label} hint={hint ?? (isJson ? 'JSON value' : undefined)}>
      <TextInput
        mono={isJson}
        placeholder={isJson ? (field.type === 'array' ? '[ ... ]' : '{ ... }') : undefined}
        value={
          value == null
            ? ''
            : isJson && typeof value !== 'string'
              ? JSON.stringify(value)
              : String(value)
        }
        onChange={(e) => {
          const v = e.target.value;
          if (!isJson) return onChange(v);
          try {
            onChange(v === '' ? undefined : JSON.parse(v));
          } catch {
            onChange(v); // hold raw string; backend will reject if invalid
          }
        }}
      />
    </Field>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-border rounded-md bg-bg p-4 h-[180px] animate-pulse">
      <div className="h-4 w-32 bg-panel rounded mb-2" />
      <div className="h-3 w-20 bg-panel rounded mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-panel rounded" />
        <div className="h-3 w-3/4 bg-panel rounded" />
        <div className="h-3 w-1/2 bg-panel rounded" />
      </div>
    </div>
  );
}

function EventTicker() {
  const [entries, setEntries] = useState<TickerEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(queueEventStreamUrl(), { withCredentials: true });
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!stopped) retryTimer = setTimeout(connect, 3000);
      };
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as QueueEvent;
          const text = formatEvent(ev);
          if (!text) return;
          const tone = ev.type.replace('job_', '') as TickerEntry['tone'];
          const id = `${Date.now()}-${seq.current++}`;
          setEntries((prev) => [{ id, ts: Date.now(), text, tone }, ...prev].slice(0, TICKER_MAX));
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Live events</Eyebrow>
        <span
          className={`text-[10px] uppercase tracking-[0.18em] ${
            connected ? 'text-emerald-700' : 'text-muted'
          }`}
        >
          {connected ? '● connected' : '○ reconnecting…'}
        </span>
      </div>
      <div className="border border-border rounded-md bg-panel/30 max-h-64 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted px-3 py-4">
            waiting for events…
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {entries.map((e) => (
              <li key={e.id} className="px-3 py-1.5 flex items-baseline gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass(e.tone)}`} />
                <span className="text-muted font-mono w-16 shrink-0">{relTime(new Date(e.ts).toISOString())}</span>
                <span className="truncate text-fg/90">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatEvent(ev: QueueEvent): string | null {
  switch (ev.type) {
    case 'job_queued':
      return `queued · ${ev.job_type} · ${ev.job_id.slice(0, 8)} (priority ${ev.priority})`;
    case 'job_dispatched':
      return `dispatched · ${ev.job_type} · ${ev.job_id.slice(0, 8)}`;
    case 'job_completed':
      return `completed · ${ev.job_type} · ${ev.job_id.slice(0, 8)} in ${ev.duration_s.toFixed(1)}s`;
    case 'job_failed':
      return `failed · ${ev.job_type} · ${ev.job_id.slice(0, 8)} · ${ev.error}`;
    case 'job_cancelled':
      return `cancelled · ${ev.job_id.slice(0, 8)}`;
    default:
      return null;
  }
}

function dotClass(tone: TickerEntry['tone']): string {
  switch (tone) {
    case 'completed':
      return 'bg-emerald-500';
    case 'failed':
      return 'bg-red-500';
    case 'cancelled':
      return 'bg-amber-500';
    case 'dispatched':
      return 'bg-sky-500';
    case 'queued':
    default:
      return 'bg-muted';
  }
}
