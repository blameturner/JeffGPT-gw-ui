import { useEffect, useMemo, useRef, useState } from 'react';
import { harvestApi, type HarvestHostConfig } from '../../api/harvest';
import { listApis } from '../connectors/api';
import type { ApiConnection } from '../connectors/types';
import { Btn, Empty, TextInput } from '../../components/ui';

export function HostsTable() {
  const [hosts, setHosts] = useState<Record<string, HarvestHostConfig> | null>(null);
  const [reloading, setReloading] = useState(false);
  const [connections, setConnections] = useState<ApiConnection[] | null>(null);
  const [newHostInput, setNewHostInput] = useState('');

  const load = () =>
    harvestApi
      .hosts()
      .then((r) => setHosts(r.hosts))
      .catch(() => setHosts({}));

  useEffect(() => {
    void load();
    listApis().then((r) => setConnections(r.apis)).catch(() => setConnections([]));
  }, []);

  const sorted = useMemo(() => {
    if (!hosts) return [] as Array<[string, HarvestHostConfig]>;
    return Object.entries(hosts).sort(([a], [b]) => a.localeCompare(b));
  }, [hosts]);

  const reload = async () => {
    setReloading(true);
    try {
      await harvestApi.reloadHosts();
      await load();
    } finally {
      setReloading(false);
    }
  };

  const addHost = async () => {
    const host = parseHost(newHostInput);
    if (!host) return;
    await harvestApi.patchHost(host, {});
    setNewHostInput('');
    await load();
  };

  const onPatch = async (host: string, patch: HarvestHostConfig) => {
    const next = await harvestApi.patchHost(host, patch);
    setHosts((prev) => ({ ...(prev ?? {}), [host]: next.config }));
  };

  const onDelete = async (host: string) => {
    await harvestApi.deleteHost(host);
    setHosts((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      delete next[host];
      return next;
    });
  };

  return (
    <div className="px-5 sm:px-7 py-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 max-w-md">
          <TextInput
            mono
            value={newHostInput}
            onChange={(e) => setNewHostInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addHost();
            }}
            placeholder="add host (paste URL or domain)"
          />
        </div>
        <Btn variant="primary" onClick={() => void addHost()}>
          + Add host
        </Btn>
        <Btn variant="ghost" size="sm" onClick={reload} disabled={reloading} className="ml-auto">
          {reloading ? 'Reloading…' : 'Reload from disk'}
        </Btn>
      </div>

      {hosts == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : sorted.length === 0 ? (
        <Empty
          title="No host overrides"
          hint="All hosts use defaults. Add one above to set per-host rate limits or auth."
        />
      ) : (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted border-b border-border bg-panel/40">
                <th className="text-left py-2 px-3">host</th>
                <th className="text-right py-2 px-3 w-24">rate (s)</th>
                <th className="text-center py-2 px-3 w-20">robots</th>
                <th className="text-center py-2 px-3 w-24">headless</th>
                <th className="text-left py-2 px-3 w-44">connection</th>
                <th className="text-left py-2 px-3">notes</th>
                <th className="py-2 px-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(([host, cfg]) => (
                <HostRow
                  key={host}
                  host={host}
                  cfg={cfg}
                  connections={connections}
                  onPatch={(p) => void onPatch(host, p)}
                  onDelete={() => void onDelete(host)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function parseHost(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    if (/^https?:\/\//i.test(s)) return new URL(s).hostname;
  } catch {
    /* fallthrough */
  }
  return s.replace(/^\/+|\/+$/g, '') || null;
}

function HostRow({
  host,
  cfg,
  connections,
  onPatch,
  onDelete,
}: {
  host: string;
  cfg: HarvestHostConfig;
  connections: ApiConnection[] | null;
  onPatch: (p: HarvestHostConfig) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<HarvestHostConfig>(cfg);
  useEffect(() => setDraft(cfg), [cfg]);

  const tRef = useRef<number | null>(null);
  const debouncedPatch = (next: HarvestHostConfig) => {
    setDraft(next);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => onPatch(next), 1000);
  };

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-panel/40">
      <td className="py-1.5 px-3 font-mono text-xs">{host}</td>
      <td className="py-1.5 px-3 text-right">
        <input
          inputMode="decimal"
          value={draft.rate_limit_per_host_s ?? ''}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, '');
            debouncedPatch({ ...draft, rate_limit_per_host_s: v ? Number(v) : null });
          }}
          className="w-20 bg-bg border border-border rounded-sm px-1.5 py-0.5 text-xs font-mono text-right focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10"
        />
      </td>
      <td className="py-1.5 px-3 text-center">
        <input
          type="checkbox"
          checked={!!draft.respect_robots}
          onChange={(e) => debouncedPatch({ ...draft, respect_robots: e.target.checked })}
          className="accent-fg"
        />
      </td>
      <td className="py-1.5 px-3 text-center">
        <input
          type="checkbox"
          checked={!!draft.headless_fallback}
          onChange={(e) => debouncedPatch({ ...draft, headless_fallback: e.target.checked })}
          className="accent-fg"
        />
      </td>
      <td className="py-1.5 px-3">
        <select
          value={draft.connection_id ?? ''}
          onChange={(e) =>
            debouncedPatch({
              ...draft,
              connection_id: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="bg-bg border border-border rounded-sm text-xs px-1.5 py-0.5 focus:outline-none focus:border-fg"
        >
          <option value="">— none —</option>
          {(connections ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5 px-3">
        <input
          value={draft.notes ?? ''}
          onChange={(e) => debouncedPatch({ ...draft, notes: e.target.value })}
          className="w-full bg-bg border border-border rounded-sm px-1.5 py-0.5 text-xs focus:outline-none focus:border-fg"
        />
      </td>
      <td className="py-1.5 px-3 text-right">
        <button
          onClick={onDelete}
          className="text-[14px] leading-none text-muted hover:text-red-700 px-1"
          title="clear override"
          aria-label={`clear override for ${host}`}
        >
          ×
        </button>
      </td>
    </tr>
  );
}
