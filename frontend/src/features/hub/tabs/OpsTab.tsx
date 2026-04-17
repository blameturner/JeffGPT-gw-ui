import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { orgMe } from '../../../api/auth/orgMe';
import { startPathfinder } from '../../../api/enrichment/pathfinder';
import { startScraper } from '../../../api/enrichment/scraper';
import { startDiscoverAgent } from '../../../api/enrichment/startDiscoverAgent';
import type { ChainKickResponse } from '../../../api/enrichment/chainKick';
import { getOpsDashboard } from '../../../api/ops/getOpsDashboard';
import { getQueueJob } from '../../../api/queue/getQueueJob';
import { getDiscoveryRow } from '../../../api/enrichment/getDiscoveryRow';
import { getScrapeTargetRow } from '../../../api/enrichment/getScrapeTargetRow';
import type { QueueEvent } from '../../../api/types/QueueEvent';
import type { OpsDashboardResponse } from '../../../api/types/OpsDashboard';
import type { QueueJob } from '../../../api/types/QueueJob';
import { gatewayUrl } from '../../../lib/runtime-env';
import { Sheet } from '../../../components/Sheet';

const DASH_LIMIT = 20;

type DrawerKind = 'job' | 'discovery' | 'target';

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function getOrgIdFromMe(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { org?: Record<string, unknown> };
  const org = p.org;
  if (!org) return null;
  return asNumber(org.id ?? org.Id ?? org.org_id);
}

function valueAt(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '-';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function fmtWhen(v?: string | null): string {
  if (!v) return '-';
  const t = Date.parse(v);
  if (Number.isNaN(t)) return v;
  return new Date(t).toLocaleString();
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function formatKick(r: ChainKickResponse): string {
  switch (r.status) {
    case 'kicked':
      return `kicked (queued ${r.queued})`;
    case 'already_running':
      return `already running (inflight ${r.inflight})`;
    case 'disabled':
      return 'disabled';
    case 'no_queue':
      return 'no_queue';
  }
}

export function OpsTab() {
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgInput, setOrgInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OpsDashboardResponse | null>(null);

  const [kickStatus, setKickStatus] = useState<string | null>(null);
  const [kickBusy, setKickBusy] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKind, setDrawerKind] = useState<DrawerKind | null>(null);
  const [drawerId, setDrawerId] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<unknown>(null);

  const esRef = useRef<EventSource | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const queueJobs = data?.queue_jobs?.rows ?? [];
  const discoveryRows = data?.discovery?.rows ?? [];
  const scrapeRows = data?.scrape_targets?.rows ?? [];

  const loadDashboard = useCallback(async () => {
    if (orgId == null) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getOpsDashboard({ org_id: orgId, limit: DASH_LIMIT });
      setData(next);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to load ops dashboard');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const queueTotals = useMemo(() => {
    const entries = Object.values(data?.queue?.counts ?? {});
    return entries.reduce(
      (acc, c) => ({
        queued: acc.queued + (c.queued ?? 0),
        running: acc.running + (c.running ?? 0),
        completed: acc.completed + (c.completed ?? 0),
      }),
      { queued: 0, running: 0, completed: 0 },
    );
  }, [data]);

  useEffect(() => {
    orgMe()
      .then((res) => {
        const id = getOrgIdFromMe(res);
        if (id != null) {
          setOrgId(id);
          setOrgInput(String(id));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (orgId == null) return;

    let active = true;

    function scheduleRefresh() {
      if (refreshTimerRef.current != null) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadDashboard();
      }, 400);
    }

    function connect() {
      if (!active) return;
      const es = new EventSource(`${gatewayUrl()}/api/queue/events`, { withCredentials: true });
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as QueueEvent;
          if (ev.type) scheduleRefresh();
        } catch {
          // keepalive comments and malformed payloads are ignored
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!active) return;
        window.setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      active = false;
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [orgId, loadDashboard]);

  async function kick(kind: 'scraper' | 'pathfinder' | 'discover') {
    setKickBusy(true);
    setKickStatus(null);
    try {
      const res =
        kind === 'scraper'
          ? await startScraper()
          : kind === 'pathfinder'
          ? await startPathfinder()
          : await startDiscoverAgent();
      setKickStatus(`${kind}: ${formatKick(res)}`);
      void loadDashboard();
    } catch (err) {
      setKickStatus(`${kind}: error ${(err as Error).message}`);
    } finally {
      setKickBusy(false);
    }
  }

  async function openDrawer(kind: DrawerKind, id: string) {
    setDrawerKind(kind);
    setDrawerId(id);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerData(null);
    try {
      if (kind === 'job') {
        const job = await getQueueJob(id);
        setDrawerData(job);
      } else if (kind === 'discovery') {
        const row = await getDiscoveryRow(id);
        setDrawerData(row);
      } else {
        const row = await getScrapeTargetRow(id);
        setDrawerData(row);
      }
    } catch (err) {
      setDrawerError((err as Error).message ?? 'Failed to load details');
    } finally {
      setDrawerLoading(false);
    }
  }

  function rowIdFromAny(row: Record<string, unknown>): string | null {
    const id = row.Id ?? row.id;
    if (id == null) return null;
    return String(id);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Org ID</label>
          <input
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            className="px-3 py-2 w-36 rounded border border-border bg-panel text-fg text-sm font-sans"
            placeholder="1"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const parsed = asNumber(orgInput);
            if (parsed != null) setOrgId(parsed);
          }}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel"
        >
          Refresh
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={kickBusy}
            onClick={() => void kick('scraper')}
            className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
          >
            Kick scraper
          </button>
          <button
            type="button"
            disabled={kickBusy}
            onClick={() => void kick('pathfinder')}
            className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
          >
            Kick pathfinder
          </button>
          <button
            type="button"
            disabled={kickBusy}
            onClick={() => void kick('discover')}
            className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
          >
            Kick discover-agent
          </button>
        </div>
      </div>

      {kickStatus && <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{kickStatus}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card title="Tool queue ready" value={data?.runtime?.tool_queue_ready ? 'yes' : 'no'} />
        <Card title="Huey enabled" value={data?.runtime?.huey?.enabled ? 'yes' : 'no'} />
        <Card title="Huey consumer" value={data?.runtime?.huey?.consumer_running ? 'running' : 'stopped'} />
        <Card title="Huey workers" value={fmt(data?.runtime?.huey?.workers)} />
        <Card title="Active jobs" value={fmt(data?.active_summary?.active)} />
        <Card title="Queued jobs" value={fmt(data?.active_summary?.queued ?? queueTotals.queued)} />
        <Card title="Running jobs" value={fmt(data?.active_summary?.running ?? queueTotals.running)} />
        <Card title="Next agent run" value={fmtWhen(data?.scheduler?.next_run)} />
        <Card title="Next enrichment run" value={fmtWhen(data?.scheduler?.next_enrichment_run)} />
      </div>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Scheduler</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border rounded p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">Agent schedules</p>
            <div className="space-y-1 text-sm font-sans">
              {(data?.scheduler?.agent_schedules ?? []).map((s) => (
                <div key={s.id} className="flex justify-between gap-2">
                  <span className="text-fg">{s.id}</span>
                  <span className="text-muted">{fmtWhen(s.next_run)}</span>
                </div>
              ))}
              {(data?.scheduler?.agent_schedules ?? []).length === 0 && <p className="text-muted">None</p>}
            </div>
          </div>
          <div className="border border-border rounded p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">Enrichment schedules</p>
            <div className="space-y-1 text-sm font-sans">
              {(data?.scheduler?.enrichment_schedules ?? []).map((s) => (
                <div key={s.id} className="flex justify-between gap-2">
                  <span className="text-fg">{s.id}</span>
                  <span className="text-muted">{fmtWhen(s.next_run)}</span>
                </div>
              ))}
              {(data?.scheduler?.enrichment_schedules ?? []).length === 0 && <p className="text-muted">None</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Recent queue jobs</h3>
        <div className="overflow-x-auto border border-border rounded">
          <table className="w-full text-sm font-sans">
            <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Priority</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Task</th>
                <th className="px-3 py-2 text-left">Result</th>
                <th className="px-3 py-2 text-left">Error</th>
                <th className="px-3 py-2 text-left">Started</th>
                <th className="px-3 py-2 text-left">Completed</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {queueJobs.map((job: QueueJob) => (
                <tr key={job.job_id} className="hover:bg-panel/30">
                  <td className="px-3 py-2">{job.type}</td>
                  <td className="px-3 py-2">{job.status}</td>
                  <td className="px-3 py-2">{job.priority}</td>
                  <td className="px-3 py-2">{fmt(job.source)}</td>
                  <td className="px-3 py-2 max-w-[18rem] truncate">{fmt(job.task)}</td>
                  <td className="px-3 py-2">{fmt(job.result_status)}</td>
                  <td className="px-3 py-2 max-w-[14rem] truncate">{fmt(job.error)}</td>
                  <td className="px-3 py-2">{fmtWhen(job.started_at)}</td>
                  <td className="px-3 py-2">{fmtWhen(job.completed_at)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void openDrawer('job', job.job_id)}
                      className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && queueJobs.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted text-xs">No jobs</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Discovery</h3>
        <div className="overflow-x-auto border border-border rounded">
          <table className="w-full text-sm font-sans">
            <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2 text-left">URL</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Depth</th>
                <th className="px-3 py-2 text-left">Domain</th>
                <th className="px-3 py-2 text-left">Error</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {discoveryRows.map((row, idx) => {
                const r = row as Record<string, unknown>;
                const id = rowIdFromAny(r);
                return (
                  <tr key={id ?? `disc-${idx}`} className="hover:bg-panel/30">
                    <td className="px-3 py-2 max-w-[24rem] truncate">{fmt(valueAt(r, 'url'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'status'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'score'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'depth'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'domain'))}</td>
                    <td className="px-3 py-2 max-w-[14rem] truncate">{fmt(valueAt(r, 'error_message'))}</td>
                    <td className="px-3 py-2">{fmtWhen(valueAt(r, 'CreatedAt') as string | null | undefined)}</td>
                    <td className="px-3 py-2">
                      {id ? (
                        <button
                          type="button"
                          onClick={() => void openDrawer('discovery', id)}
                          className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                        >
                          Open
                        </button>
                      ) : (
                        <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && discoveryRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted text-xs">No discovery rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Scrape targets</h3>
        <div className="overflow-x-auto border border-border rounded">
          <table className="w-full text-sm font-sans">
            <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2 text-left">URL</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Relevance label</th>
                <th className="px-3 py-2 text-left">Relevance score</th>
                <th className="px-3 py-2 text-left">Chunk count</th>
                <th className="px-3 py-2 text-left">Consecutive fails</th>
                <th className="px-3 py-2 text-left">Consecutive unchanged</th>
                <th className="px-3 py-2 text-left">Next crawl</th>
                <th className="px-3 py-2 text-left">Last scrape error</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scrapeRows.map((row, idx) => {
                const r = row as Record<string, unknown>;
                const id = rowIdFromAny(r);
                return (
                  <tr key={id ?? `scrape-${idx}`} className="hover:bg-panel/30">
                    <td className="px-3 py-2 max-w-[24rem] truncate">{fmt(valueAt(r, 'url'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'status'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'active'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'relevance_label'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'relevance_score'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'chunk_count'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'consecutive_failures'))}</td>
                    <td className="px-3 py-2">{fmt(valueAt(r, 'consecutive_unchanged'))}</td>
                    <td className="px-3 py-2">{fmtWhen(valueAt(r, 'next_crawl_at') as string | null | undefined)}</td>
                    <td className="px-3 py-2 max-w-[16rem] truncate">{fmt(valueAt(r, 'last_scrape_error'))}</td>
                    <td className="px-3 py-2">
                      {id ? (
                        <button
                          type="button"
                          onClick={() => void openDrawer('target', id)}
                          className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                        >
                          Open
                        </button>
                      ) : (
                        <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && scrapeRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-muted text-xs">No scrape targets</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Sheet
        open={drawerOpen}
        side="right"
        onClose={() => setDrawerOpen(false)}
        widthClass="w-[92vw] max-w-[760px]"
        mobileOnlyClass=""
        label="Detail drawer"
      >
        <div className="h-full flex flex-col">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {drawerKind ?? 'detail'} / {drawerId}
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
            {drawerLoading && <p className="text-sm text-muted">Loading details...</p>}
            {drawerError && <p className="text-xs text-red-500">{drawerError}</p>}
            {!drawerLoading && !drawerError && (
              <details open>
                <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">Raw JSON</summary>
                <pre className="mt-2 p-3 rounded border border-border bg-panel/60 text-xs whitespace-pre-wrap break-words">
                  {safeStringify(drawerData)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function Card(props: { title: string; value: string }) {
  return (
    <div className="border border-border rounded p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted mb-1">{props.title}</p>
      <p className="text-sm font-sans text-fg break-words">{props.value}</p>
    </div>
  );
}


