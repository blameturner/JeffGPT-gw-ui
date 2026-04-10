import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, type DockerContainer, type LlmModel } from '../lib/api';
import { gatewayUrl } from '../lib/runtime-env';
import { authClient } from '../lib/auth-client';

interface HealthStatus {
  status: string;
  harness: string;
}

type ConnectionState = 'ok' | 'degraded' | 'down' | 'loading';

function ArchitecturePage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [connState, setConnState] = useState<ConnectionState>('loading');

  useEffect(() => {
    Promise.all([
      api.logs.containers().then((r) => setContainers(r.containers)).catch(() => {}),
      api.models().then((r) => setModels(r.models)).catch(() => {}),
      api.health()
        .then((r) => {
          setHealth(r);
          setConnState(r.harness === 'ok' ? 'ok' : 'degraded');
        })
        .catch(() => setConnState('down')),
    ]);
  }, []);

  const gw = gatewayUrl();

  // Group containers the same way the logs page does
  const grouped = groupContainers(containers);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-3xl font-semibold tracking-tightest mb-2">
            How it works
          </h1>
          <p className="text-muted text-sm font-sans max-w-2xl leading-relaxed">
            The LLM Harness is a self-hosted AI orchestration platform.
            Your browser talks to a lightweight gateway, which proxies requests
            to the harness — the core engine that manages models, agents,
            conversations, and enrichment pipelines.
          </p>
        </div>

        {/* Live status bar */}
        <div className="flex items-center gap-4 mb-10 px-4 py-3 rounded-lg border border-border bg-panel/50">
          <StatusDot state={connState} />
          <div className="text-sm font-sans">
            <span className="text-fg font-medium">
              {connState === 'ok' && 'All systems connected'}
              {connState === 'degraded' && 'Gateway up, harness unreachable'}
              {connState === 'down' && 'Gateway unreachable'}
              {connState === 'loading' && 'Checking connections\u2026'}
            </span>
            {health && (
              <span className="text-muted ml-3">
                Gateway {health.status} &middot; Harness {health.harness}
              </span>
            )}
          </div>
          <div className="ml-auto text-[11px] font-mono text-muted">
            {containers.length} container{containers.length !== 1 ? 's' : ''} &middot;{' '}
            {models.length} model{models.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Architecture diagram */}
        <section className="mb-12">
          <SectionLabel>Request flow</SectionLabel>
          <div className="border border-border rounded-lg bg-panel/30 p-6 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-[680px]">
              <DiagramBox
                label="Browser"
                sublabel="You are here"
                accent="blue"
              />
              <Arrow label="HTTPS" />
              <DiagramBox
                label="Frontend"
                sublabel="mst-ag-frontend"
                detail={`Port 3000`}
                accent="emerald"
              />
              <Arrow label="API calls" />
              <DiagramBox
                label="Gateway"
                sublabel="mst-ag-gateway"
                detail={shortenUrl(gw)}
                accent="amber"
              />
              <Arrow label="HTTP proxy" />
              <DiagramBox
                label="Harness"
                sublabel="mst-ag-harness"
                detail="Port 3800"
                accent="violet"
              />
              <Arrow label="Inference" />
              <DiagramBox
                label="LLM Models"
                sublabel={`${models.length} loaded`}
                accent="rose"
              />
            </div>
          </div>
        </section>

        {/* Layer explainers */}
        <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <ExplainerCard
            title="Frontend"
            container="mst-ag-frontend"
            color="emerald"
            items={[
              'React + TanStack Router SPA',
              'Served as static files on port 3000',
              'Reads gateway URL from /config.js at runtime',
              'Streams LLM responses via Server-Sent Events',
              'All API calls go through the gateway — never directly to the harness',
            ]}
          />
          <ExplainerCard
            title="Gateway"
            container="mst-ag-gateway"
            color="amber"
            items={[
              `Hono.js server at ${shortenUrl(gw)}`,
              'Authenticates users via Better Auth (session cookies)',
              'Proxies /api/* requests to the harness',
              'Manages org/user data in NocoDB',
              'Streams Docker container logs via /var/run/docker.sock',
              'SSE stream relay — POST starts a job, EventSource streams results',
            ]}
          />
          <ExplainerCard
            title="Harness"
            container="mst-ag-harness"
            color="violet"
            items={[
              'Core orchestration engine on port 3800',
              'Loads and manages LLM models (local or remote)',
              'Runs agents with structured output parsing',
              'Manages conversations with context summarisation',
              'Enrichment scheduler scrapes and indexes knowledge sources',
              'RAG pipeline with vector search for grounded responses',
            ]}
          />
          <ExplainerCard
            title="Data layer"
            container="nocodb + sqlite"
            color="sky"
            items={[
              'NocoDB stores agents, workers, conversations, observations',
              'Gateway queries NocoDB via its REST API (xc-token auth)',
              'Better Auth uses a local SQLite DB for user/session data',
              'Enrichment chunks stored in vector DB for retrieval',
              'FalkorDB (optional) for knowledge graph coverage',
            ]}
          />
        </section>

        {/* Streaming explainer */}
        <section className="mb-12">
          <SectionLabel>Streaming architecture</SectionLabel>
          <div className="border border-border rounded-lg bg-panel/30 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StreamStep
                step={1}
                title="POST request"
                description="Browser sends a chat/code/run request to the gateway. The gateway forwards it to the harness, which returns a job_id."
                path={`${shortenUrl(gw)}/api/chat`}
              />
              <StreamStep
                step={2}
                title="EventSource opens"
                description="Browser opens an SSE connection to the gateway's stream endpoint. The gateway proxies the SSE stream from the harness."
                path={`${shortenUrl(gw)}/api/stream/{job_id}`}
              />
              <StreamStep
                step={3}
                title="Events flow"
                description="Chunks, metadata, usage stats, and parsed output stream back in real time. Cursor-based reconnection ensures no events are lost."
                events={['chunk', 'meta', 'searching', 'parsed', 'done']}
              />
            </div>
          </div>
        </section>

        {/* Live containers */}
        <section className="mb-12">
          <SectionLabel>Running containers</SectionLabel>
          {containers.length === 0 ? (
            <div className="text-muted text-sm font-sans py-8 text-center border border-border rounded-lg">
              No container data available — is the Docker socket mounted?
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([group, items]) => (
                <div key={group}>
                  <h3 className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted mb-2">
                    {group}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map((c) => (
                      <ContainerCard key={c.id} container={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Models */}
        {models.length > 0 && (
          <section className="mb-12">
            <SectionLabel>Available models</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {models.map((m) => (
                <div
                  key={m.name}
                  className="border border-border rounded-lg px-4 py-3 bg-panel/30 hover:bg-panelHi/40 transition-colors"
                >
                  <div className="text-sm font-sans font-medium text-fg truncate">
                    {m.name}
                  </div>
                  {m.role && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.08em] font-sans border border-border text-muted">
                      {m.role}
                    </span>
                  )}
                  <div className="text-[11px] font-mono text-muted mt-1 truncate">
                    {shortenUrl(m.url)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Key URLs */}
        <section className="mb-12">
          <SectionLabel>Key endpoints</SectionLabel>
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
            <UrlRow label="Gateway URL" url={gw} />
            <UrlRow label="Health check" url={`${gw}/api/health`} />
            <UrlRow label="Chat stream" url={`${gw}/api/chat`} method="POST" />
            <UrlRow label="Code stream" url={`${gw}/api/code`} method="POST" />
            <UrlRow label="Agent run" url={`${gw}/api/run/stream`} method="POST" />
            <UrlRow label="SSE relay" url={`${gw}/api/stream/{job_id}`} method="GET" />
            <UrlRow label="Docker logs" url={`${gw}/api/logs/stream`} method="GET (SSE)" />
            <UrlRow label="Models" url={`${gw}/api/models`} />
            <UrlRow label="Enrichment" url={`${gw}/api/enrichment/sources`} />
          </div>
        </section>

        {/* Network */}
        <section className="mb-10">
          <SectionLabel>Docker network</SectionLabel>
          <div className="border border-border rounded-lg bg-panel/30 p-6">
            <p className="text-sm font-sans text-muted leading-relaxed mb-4">
              All containers share the <code className="text-fg font-mono text-xs">mst-ag-01-network</code> bridge
              network. Internal container-to-container traffic uses Docker DNS
              names (e.g. <code className="text-fg font-mono text-xs">http://mst-ag-harness:3800</code>).
              Only the frontend (3000) and gateway (3900) expose ports to the host.
            </p>
            <div className="flex flex-wrap gap-2">
              {containers.length > 0 ? (
                containers.map((c) => (
                  <span
                    key={c.id}
                    className={[
                      'px-2.5 py-1 rounded-md text-[11px] font-mono border',
                      c.state === 'running'
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700'
                        : 'border-border bg-panel text-muted',
                    ].join(' ')}
                  >
                    {c.name}
                  </span>
                ))
              ) : (
                <span className="text-muted text-sm font-sans">Loading containers...</span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// -- Components ---------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted mb-3">
      {children}
    </h2>
  );
}

function StatusDot({ state }: { state: ConnectionState }) {
  const color = {
    ok: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
    loading: 'bg-muted animate-blink',
  }[state];
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />;
}

function DiagramBox({
  label,
  sublabel,
  detail,
  accent,
}: {
  label: string;
  sublabel: string;
  detail?: string;
  accent: string;
}) {
  const borderColor: Record<string, string> = {
    blue: 'border-blue-400/40',
    emerald: 'border-emerald-400/40',
    amber: 'border-amber-400/40',
    violet: 'border-violet-400/40',
    rose: 'border-rose-400/40',
  };
  const dotColor: Record<string, string> = {
    blue: 'bg-blue-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    violet: 'bg-violet-400',
    rose: 'bg-rose-400',
  };
  return (
    <div
      className={`shrink-0 border ${borderColor[accent] ?? 'border-border'} rounded-lg px-4 py-3 bg-panel/50 min-w-[110px] text-center`}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotColor[accent] ?? 'bg-muted'}`} />
        <span className="text-sm font-sans font-medium text-fg">{label}</span>
      </div>
      <div className="text-[10px] font-mono text-muted">{sublabel}</div>
      {detail && <div className="text-[10px] font-mono text-muted/60 mt-0.5">{detail}</div>}
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center px-1 shrink-0">
      <span className="text-[9px] uppercase tracking-[0.1em] font-sans text-muted/60 mb-0.5 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center">
        <div className="w-8 h-px bg-border" />
        <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-border" />
      </div>
    </div>
  );
}

function ExplainerCard({
  title,
  container,
  color,
  items,
}: {
  title: string;
  container: string;
  color: string;
  items: string[];
}) {
  const borderColor: Record<string, string> = {
    emerald: 'border-l-emerald-400',
    amber: 'border-l-amber-400',
    violet: 'border-l-violet-400',
    sky: 'border-l-sky-400',
  };
  return (
    <div
      className={`border border-border ${borderColor[color] ?? ''} border-l-2 rounded-lg px-5 py-4 bg-panel/30`}
    >
      <h3 className="text-base font-display font-semibold tracking-tightest mb-0.5">
        {title}
      </h3>
      <div className="text-[10px] font-mono text-muted mb-3">{container}</div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-[12.5px] font-sans text-fg/80 leading-snug flex gap-2">
            <span className="text-muted/40 select-none shrink-0">&bull;</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StreamStep({
  step,
  title,
  description,
  path,
  events,
}: {
  step: number;
  title: string;
  description: string;
  path?: string;
  events?: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-fg text-bg flex items-center justify-center text-xs font-sans font-semibold">
          {step}
        </span>
        <span className="text-sm font-sans font-medium text-fg">{title}</span>
      </div>
      <p className="text-[12.5px] font-sans text-muted leading-relaxed">{description}</p>
      {path && (
        <code className="block mt-2 text-[11px] font-mono text-muted/70 break-all">
          {path}
        </code>
      )}
      {events && (
        <div className="flex flex-wrap gap-1 mt-2">
          {events.map((e) => (
            <span
              key={e}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-border text-muted"
            >
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ContainerCard({ container: c }: { container: DockerContainer }) {
  const running = c.state === 'running';
  return (
    <div className="border border-border rounded-lg px-4 py-3 bg-panel/30 hover:bg-panelHi/40 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-emerald-500' : 'bg-red-500/60'}`}
        />
        <span className="text-sm font-sans font-medium text-fg truncate">{c.name}</span>
      </div>
      <div className="text-[11px] font-mono text-muted truncate">{c.image}</div>
      <div className="text-[10px] font-sans text-muted/60 mt-0.5">{c.status}</div>
    </div>
  );
}

function UrlRow({
  label,
  url,
  method,
}: {
  label: string;
  url: string;
  method?: string;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 hover:bg-panelHi/40 transition-colors">
      <span className="text-sm font-sans text-fg w-36 shrink-0">{label}</span>
      {method && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border border-border text-muted shrink-0">
          {method}
        </span>
      )}
      <code className="text-[11px] font-mono text-muted truncate">{url}</code>
    </div>
  );
}

// -- Helpers ------------------------------------------------------------------

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
  } catch {
    return url;
  }
}

function inferGroup(c: DockerContainer): string {
  const name = c.name.toLowerCase();
  const image = c.image.toLowerCase();
  if (
    name.includes('llama') || name.includes('model') || name.includes('reasoner') ||
    name.includes('coder') || name.includes('fast') ||
    image.includes('llama') || image.includes('gguf') || image.includes('vllm')
  ) return 'Models';
  if (
    name.includes('redis') || name.includes('postgres') || name.includes('nocodb') ||
    name.includes('falkor') || name.includes('mysql') || name.includes('mongo') ||
    image.includes('redis') || image.includes('postgres') || image.includes('nocodb') ||
    image.includes('falkor')
  ) return 'Data';
  if (
    name.includes('nginx') || name.includes('proxy') || name.includes('traefik') ||
    name.includes('caddy') || image.includes('nginx') || image.includes('proxy')
  ) return 'Proxy';
  return 'Services';
}

function groupContainers(
  containers: DockerContainer[],
): [string, DockerContainer[]][] {
  const groups = new Map<string, DockerContainer[]>();
  for (const c of containers) {
    const group = inferGroup(c);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(c);
  }
  const order = ['Models', 'Services', 'Data', 'Proxy'];
  return [...groups.entries()].sort(
    (a, b) =>
      (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) -
      (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])),
  );
}

export const Route = createFileRoute('/architecture')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: ArchitecturePage,
});