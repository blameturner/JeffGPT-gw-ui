import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrimaryButton, Toolbar } from '../components/Toolbar';
import { EmptyState } from '../components/EmptyState';
import { ApisList } from './ApisList';
import { ApiDetailDrawer } from './ApiDetailDrawer';
import { RegisterApiWizard } from './RegisterApiWizard';
import { listApis, registerApi } from '../api';
import type { ApiConnection, ConnectorStatus } from '../types';

type StatusFilter = 'all' | ConnectorStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'failed', label: 'Failed' },
  { value: 'unverified', label: 'Unverified' },
];

export function ApisTab() {
  const [apis, setApis] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<number | null>(null);

  // Debounce search input → search (250ms client-side filter)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearch(searchInput), 250);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listApis();
      setApis(res.apis ?? []);
    } catch (e) {
      console.error('listApis failed', e);
      setError((e as Error).message || 'Failed to load APIs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apis.filter((a) => {
      if (statusFilter !== 'all') {
        if ((a.status ?? 'unverified') !== statusFilter) return false;
      }
      if (!q) return true;
      const hay = [a.name, a.base_url, a.description ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [apis, search, statusFilter]);

  function handleChanged(updated: ApiConnection) {
    setApis((prev) => {
      const idx = prev.findIndex((p) => p.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = prev.slice();
      next[idx] = updated;
      return next;
    });
  }

  function handleDeleted(id: number) {
    setApis((prev) => prev.filter((p) => p.id !== id));
  }

  function handleRowDelete(api: ApiConnection) {
    // From the row kebab — open detail drawer so the user goes through DangerZone confirm.
    setDrawerId(api.id);
  }

  async function handleDuplicate(api: ApiConnection) {
    try {
      const created = await registerApi({
        name: `${api.name} (copy)`,
        description: api.description ?? null,
        base_url: api.base_url,
        auth_type: api.auth_type,
        auth_secret_ref: api.auth_secret_ref ?? null,
        auth_extra_json: api.auth_extra_json ?? null,
        default_headers_json: api.default_headers_json ?? null,
        default_query_json: api.default_query_json ?? null,
        allowed_methods: api.allowed_methods ?? null,
        allowed_paths_regex: api.allowed_paths_regex ?? null,
        timeout_seconds: api.timeout_seconds ?? null,
        rate_limit_per_min: api.rate_limit_per_min ?? null,
        openapi_url: api.openapi_url ?? null,
      });
      await refresh();
      setDrawerId(created.id);
    } catch (e) {
      console.error('duplicate failed', e);
      setError((e as Error).message || 'Failed to duplicate API.');
    }
  }

  async function handleCreated(newId: number) {
    await refresh();
    setDrawerId(newId);
  }

  const showEmpty = !loading && !error && apis.length === 0;

  return (
    <div className="flex flex-col">
      <Toolbar
        title="APIs"
        count={apis.length}
        search={searchInput}
        onSearch={setSearchInput}
        filter={
          <StatusFilterChip value={statusFilter} onChange={setStatusFilter} />
        }
        primary={
          <PrimaryButton onClick={() => setWizardOpen(true)}>+ Register API</PrimaryButton>
        }
      />

      {showEmpty ? (
        <EmptyState
          title="No APIs registered yet"
          body="Register your first API to give agents access to external services."
          cta={<PrimaryButton onClick={() => setWizardOpen(true)}>+ Register API</PrimaryButton>}
        />
      ) : (
        <ApisList
          apis={filtered}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
          onRowClick={(a) => setDrawerId(a.id)}
          onDelete={handleRowDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      <ApiDetailDrawer
        open={drawerId != null}
        apiId={drawerId}
        onClose={() => setDrawerId(null)}
        onChanged={handleChanged}
        onDeleted={handleDeleted}
      />

      <RegisterApiWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function StatusFilterChip({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const label = STATUS_OPTIONS.find((o) => o.value === value)?.label ?? 'All';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border text-fg px-3 py-2 hover:border-fg transition"
      >
        Status: {label} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 border border-border bg-bg shadow-card min-w-[140px]">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={[
                'block w-full text-left px-3 py-2 text-sm hover:bg-panelHi',
                value === o.value ? 'font-sans text-fg' : 'text-muted',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

