import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from '../components/Drawer';
import { StatusChip } from '../components/StatusChip';
import { JsonEditor } from '../components/JsonEditor';
import { UsagePromptEditor } from '../components/UsagePromptEditor';
import { DangerZone } from '../components/DangerZone';
import { Field, TextInput } from '../components/Field';
import { GhostButton, PrimaryButton, SecondaryButton } from '../components/Toolbar';
import { AuthFields, type AuthFieldsValue } from './AuthFields';
import { TestCallModal } from './TestCallModal';
import {
  deleteApi,
  getApi,
  inspectApi,
  patchApi,
} from '../api';
import type { ApiConnection, HttpMethod } from '../types';

const ALL_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  if (sec < 60) return `${sec}s ${diff >= 0 ? 'ago' : 'from now'}`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ${diff >= 0 ? 'ago' : 'from now'}`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ${diff >= 0 ? 'ago' : 'from now'}`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day}d ${diff >= 0 ? 'ago' : 'from now'}`;
  const mo = Math.round(day / 30);
  return `${mo}mo ${diff >= 0 ? 'ago' : 'from now'}`;
}

function fmtAbsolute(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ApiDetailDrawer({
  open,
  apiId,
  onClose,
  onChanged,
  onDeleted,
}: {
  open: boolean;
  apiId: number | null;
  onClose: () => void;
  onChanged: (api: ApiConnection) => void;
  onDeleted: (id: number) => void;
}) {
  const [api, setApi] = useState<ApiConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inline name editor
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Section local edits
  const [authDirty, setAuthDirty] = useState(false);
  const [authState, setAuthState] = useState<AuthFieldsValue>({
    authType: 'none',
    authSecretRef: null,
    authExtra: {},
  });

  const [savingAuth, setSavingAuth] = useState(false);

  // Inspect
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [flashUsage, setFlashUsage] = useState(false);

  // Usage prompt local
  const [usagePrompt, setUsagePrompt] = useState('');
  const [usageDirty, setUsageDirty] = useState(false);
  const [savingUsage, setSavingUsage] = useState(false);

  // Test call modal
  const [testOpen, setTestOpen] = useState(false);

  // Inspection log
  const [logOpen, setLogOpen] = useState(false);

  // Endpoint search
  const [endpointQ, setEndpointQ] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState(false);

  // Save notice (per section)
  const [notice, setNotice] = useState<{ section: string; kind: 'ok' | 'err'; msg: string } | null>(null);

  // Load + reset on open / id change
  useEffect(() => {
    if (!open || apiId == null) {
      setApi(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getApi(apiId)
      .then((res) => {
        if (cancelled) return;
        setApi(res);
        hydrate(res);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('getApi failed', e);
        setLoadError((e as Error).message || 'Failed to load API.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, apiId]);

  function hydrate(rec: ApiConnection) {
    setDraftName(rec.name);
    setEditingName(false);
    setAuthState({
      authType: rec.auth_type,
      authSecretRef: rec.auth_secret_ref ?? null,
      authExtra: (rec.auth_extra_json as Record<string, unknown>) ?? {},
    });
    setAuthDirty(false);
    setUsagePrompt(rec.usage_prompt ?? '');
    setUsageDirty(false);
    setFlashUsage(false);
    setInspectError(null);
    setEndpointQ('');
    setNotice(null);
  }

  // ---- Inline name save ----
  async function saveName() {
    if (!api) return;
    const next = draftName.trim();
    if (!next || next === api.name) {
      setEditingName(false);
      setDraftName(api.name);
      return;
    }
    const previous = api;
    // optimistic
    const optimistic = { ...api, name: next };
    setApi(optimistic);
    setEditingName(false);
    onChanged(optimistic);
    try {
      const saved = await patchApi(api.id, { name: next });
      setApi(saved);
      onChanged(saved);
    } catch (e) {
      console.error('rename failed', e);
      setApi(previous);
      setDraftName(previous.name);
      onChanged(previous);
      setNotice({ section: 'name', kind: 'err', msg: (e as Error).message || 'Rename failed.' });
    }
  }

  // ---- Section: Auth ----
  async function saveAuth() {
    if (!api) return;
    setSavingAuth(true);
    setNotice(null);
    try {
      const saved = await patchApi(api.id, {
        auth_type: authState.authType,
        auth_secret_ref: authState.authSecretRef ?? null,
        auth_extra_json: Object.keys(authState.authExtra).length ? authState.authExtra : null,
      });
      setApi(saved);
      onChanged(saved);
      setAuthDirty(false);
      setNotice({ section: 'auth', kind: 'ok', msg: 'Authentication saved.' });
    } catch (e) {
      console.error('saveAuth failed', e);
      setNotice({ section: 'auth', kind: 'err', msg: (e as Error).message || 'Failed to save auth.' });
    } finally {
      setSavingAuth(false);
    }
  }

  // ---- Section: Defaults ----
  async function saveField<K extends keyof ApiConnection>(field: K, value: ApiConnection[K], section: string) {
    if (!api) return;
    try {
      const saved = await patchApi(api.id, { [field]: value } as Partial<ApiConnection>);
      setApi(saved);
      onChanged(saved);
      setNotice({ section, kind: 'ok', msg: 'Saved.' });
    } catch (e) {
      console.error('save failed', field, e);
      setNotice({ section, kind: 'err', msg: (e as Error).message || 'Save failed.' });
    }
  }

  // ---- Section: Usage prompt ----
  async function saveUsage() {
    if (!api) return;
    setSavingUsage(true);
    setNotice(null);
    try {
      const saved = await patchApi(api.id, { usage_prompt: usagePrompt });
      setApi(saved);
      onChanged(saved);
      setUsageDirty(false);
      setNotice({ section: 'usage', kind: 'ok', msg: 'Usage prompt saved.' });
    } catch (e) {
      console.error('saveUsage failed', e);
      setNotice({ section: 'usage', kind: 'err', msg: (e as Error).message || 'Failed to save.' });
    } finally {
      setSavingUsage(false);
    }
  }

  // ---- Inspect ----
  async function runInspect() {
    if (!api) return;
    setInspecting(true);
    setInspectError(null);
    setNotice(null);
    try {
      await inspectApi(api.id);
      // Refetch the full record to pick up status, usage_prompt, inspection_summary, verified_at.
      const refreshed = await getApi(api.id);
      setApi(refreshed);
      onChanged(refreshed);
      setUsagePrompt(refreshed.usage_prompt ?? '');
      setUsageDirty(false);
      setFlashUsage(true);
      // Reset the flash flag on next tick so the flag toggles for future runs.
      setTimeout(() => setFlashUsage(false), 50);
    } catch (e) {
      console.error('inspect failed', e);
      setInspectError((e as Error).message || 'Inspection failed.');
      // Try to refetch status; non-fatal if it fails.
      try {
        const refreshed = await getApi(api.id);
        setApi(refreshed);
        onChanged(refreshed);
      } catch {
        // ignore
      }
    } finally {
      setInspecting(false);
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!api) return;
    setDeleting(true);
    try {
      await deleteApi(api.id);
      onDeleted(api.id);
      onClose();
    } catch (e) {
      console.error('delete failed', e);
      setNotice({ section: 'danger', kind: 'err', msg: (e as Error).message || 'Delete failed.' });
    } finally {
      setDeleting(false);
    }
  }

  const endpointsAll = api?.inspection_summary_json?.openapi?.summary?.endpoints_sample ?? [];
  const filteredEndpoints = useMemo(() => {
    const q = endpointQ.trim().toLowerCase();
    if (!q) return endpointsAll;
    return endpointsAll.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        (e.summary ?? '').toLowerCase().includes(q),
    );
  }, [endpointsAll, endpointQ]);

  // Header subtitle = base_url (mono)
  const subtitle = api?.base_url ?? '';

  return (
    <>
      <Drawer open={open} onClose={onClose} label="API connection details">
        {(loading || !api) && (
          <>
            <DrawerHeader title={loading ? 'Loading…' : 'API'} onClose={onClose} />
            <DrawerBody>
              {loading && (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-9 bg-panel border border-border rounded-md animate-pulse" />
                  ))}
                </div>
              )}
              {loadError && (
                <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 rounded">
                  {loadError}
                </div>
              )}
            </DrawerBody>
          </>
        )}

        {api && (
          <>
            <DrawerHeader
              title={
                <div className="flex items-center gap-2">
                  {editingName ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') {
                          setDraftName(api.name);
                          setEditingName(false);
                        }
                      }}
                      className="border border-fg bg-bg px-2 py-1 text-base font-display tracking-tightest min-w-0 max-w-[20rem]"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      title="Click to rename"
                      className="text-left hover:underline decoration-dotted underline-offset-4"
                    >
                      {api.name}
                    </button>
                  )}
                  <StatusChip status={api.status} />
                </div>
              }
              subtitle={subtitle}
              onClose={onClose}
              actions={
                <>
                  <PrimaryButton onClick={runInspect} disabled={inspecting}>
                    {inspecting ? 'Inspecting…' : 'Inspect'}
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setTestOpen(true)}>Test call</SecondaryButton>
                </>
              }
            />

            <DrawerBody>
              {/* 1. Summary */}
              <Card title="Summary">
                <DL>
                  <DRow label="Description">{api.description || <span className="text-muted">—</span>}</DRow>
                  <DRow label="Auth type">
                    <span className="font-mono">{api.auth_type}</span>
                  </DRow>
                  <DRow label="Allowed methods">
                    <span className="font-mono">
                      {(api.allowed_methods && api.allowed_methods.length ? api.allowed_methods : ALL_METHODS).join(' · ')}
                    </span>
                  </DRow>
                  <DRow label="Rate limit / min">
                    <span className="font-mono">{api.rate_limit_per_min ?? '—'}</span>
                  </DRow>
                  <DRow label="Timeout (s)">
                    <span className="font-mono">{api.timeout_seconds ?? '—'}</span>
                  </DRow>
                  <DRow label="Verified">
                    <span title={fmtAbsolute(api.verified_at)} className="font-mono">
                      {fmtRelative(api.verified_at)}
                    </span>
                  </DRow>
                </DL>
              </Card>

              {/* 2. Authentication */}
              <Card title="Authentication">
                <AuthFields
                  authType={authState.authType}
                  authSecretRef={authState.authSecretRef}
                  authExtra={authState.authExtra}
                  onChange={(next) => {
                    setAuthState(next);
                    setAuthDirty(true);
                  }}
                />
                <div className="flex items-center justify-end gap-2">
                  <SectionNotice notice={notice} section="auth" />
                  <PrimaryButton onClick={saveAuth} disabled={!authDirty || savingAuth}>
                    {savingAuth ? 'Saving…' : 'Save'}
                  </PrimaryButton>
                </div>
              </Card>

              {/* 3. Defaults */}
              <Card title="Defaults">
                <Field label="Default headers (JSON)">
                  <JsonEditor
                    value={api.default_headers_json ?? null}
                    onChange={(v) =>
                      saveField('default_headers_json', (v as Record<string, unknown> | null) ?? null, 'defaults')
                    }
                    rows={6}
                    schemaHint="object: header → value"
                  />
                </Field>
                <Field label="Default query parameters (JSON)">
                  <JsonEditor
                    value={api.default_query_json ?? null}
                    onChange={(v) =>
                      saveField('default_query_json', (v as Record<string, unknown> | null) ?? null, 'defaults')
                    }
                    rows={6}
                    schemaHint="object: param → value"
                  />
                </Field>
                <SectionNotice notice={notice} section="defaults" />
              </Card>

              {/* 4. Safety */}
              <Card title="Safety">
                <Field label="Allowed methods">
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_METHODS.map((m) => {
                      const active = (api.allowed_methods ?? []).includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            const cur = new Set(api.allowed_methods ?? []);
                            if (cur.has(m)) cur.delete(m);
                            else cur.add(m);
                            const next = ALL_METHODS.filter((x) => cur.has(x));
                            saveField('allowed_methods', next, 'safety');
                          }}
                          className={[
                            'text-[11px] uppercase tracking-[0.18em] font-sans border px-2.5 py-1 transition-colors',
                            active ? 'border-fg bg-fg text-bg' : 'border-border text-muted hover:text-fg hover:border-fg',
                          ].join(' ')}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Allowed paths regex" hint="Empty = no restriction.">
                  <DebouncedTextInput
                    value={api.allowed_paths_regex ?? ''}
                    onCommit={(v) => saveField('allowed_paths_regex', v || null, 'safety')}
                    placeholder="^/v1/(users|orders)/.*"
                    className="font-mono"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Timeout (s)">
                    <DebouncedTextInput
                      type="number"
                      value={api.timeout_seconds == null ? '' : String(api.timeout_seconds)}
                      onCommit={(v) => saveField('timeout_seconds', v ? Number(v) : null, 'safety')}
                      className="font-mono"
                    />
                  </Field>
                  <Field label="Rate limit (per min)">
                    <DebouncedTextInput
                      type="number"
                      value={api.rate_limit_per_min == null ? '' : String(api.rate_limit_per_min)}
                      onCommit={(v) => saveField('rate_limit_per_min', v ? Number(v) : null, 'safety')}
                      className="font-mono"
                    />
                  </Field>
                </div>
                <SectionNotice notice={notice} section="safety" />
              </Card>

              {/* 5. OpenAPI */}
              <Card title="OpenAPI">
                <Field label="OpenAPI URL">
                  <DebouncedTextInput
                    value={api.openapi_url ?? ''}
                    onCommit={(v) => saveField('openapi_url', v || null, 'openapi')}
                    placeholder="https://api.example.com/openapi.json"
                    className="font-mono"
                  />
                </Field>
                {endpointsAll.length > 0 && (
                  <>
                    <input
                      value={endpointQ}
                      onChange={(e) => setEndpointQ(e.target.value)}
                      placeholder="Filter endpoints…"
                      className="w-full border border-border bg-bg px-3 py-1.5 text-sm focus:outline-none focus:border-fg"
                    />
                    <details open className="border border-border rounded">
                      <summary className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">
                        Endpoints ({filteredEndpoints.length} / {endpointsAll.length})
                      </summary>
                      <ul className="divide-y divide-border max-h-72 overflow-auto">
                        {filteredEndpoints.map((e, i) => (
                          <li key={`${e.method}-${e.path}-${i}`} className="px-3 py-2 text-xs flex gap-3">
                            <span className="font-mono uppercase text-muted w-14 shrink-0">{e.method}</span>
                            <span className="font-mono flex-1 break-all">{e.path}</span>
                            {e.summary && <span className="text-muted truncate">{e.summary}</span>}
                          </li>
                        ))}
                        {filteredEndpoints.length === 0 && (
                          <li className="px-3 py-2 text-xs text-muted">No matches.</li>
                        )}
                      </ul>
                    </details>
                  </>
                )}
                <SectionNotice notice={notice} section="openapi" />
              </Card>

              {/* 6. Usage prompt */}
              <Card title="Usage prompt">
                <UsagePromptEditor
                  value={usagePrompt}
                  onChange={(v) => {
                    setUsagePrompt(v);
                    setUsageDirty(true);
                  }}
                  onRegenerate={runInspect}
                  regenerating={inspecting}
                  flash={flashUsage}
                />
                <div className="flex items-center justify-end gap-2">
                  <SectionNotice notice={notice} section="usage" />
                  <PrimaryButton onClick={saveUsage} disabled={!usageDirty || savingUsage}>
                    {savingUsage ? 'Saving…' : 'Save manual edits'}
                  </PrimaryButton>
                </div>
              </Card>

              {/* 7. Inspection log */}
              <Card title="Inspection log">
                {inspectError && (
                  <div className="border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2 rounded">
                    {inspectError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setLogOpen((s) => !s)}
                  className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
                >
                  {logOpen ? '▾' : '▸'} {logOpen ? 'Hide' : 'Show'} raw inspection
                </button>
                {logOpen && (
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <GhostButton
                        onClick={() => {
                          try {
                            void navigator.clipboard.writeText(
                              JSON.stringify(api.inspection_summary_json ?? {}, null, 2),
                            );
                          } catch (e) {
                            console.error('clipboard write failed', e);
                          }
                        }}
                      >
                        Copy
                      </GhostButton>
                    </div>
                    <pre className="font-mono text-[11px] bg-panel border border-border rounded p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(api.inspection_summary_json ?? {}, null, 2)}
                    </pre>
                  </div>
                )}
              </Card>

              {/* 8. Used by */}
              <Card title="Used by">
                {api.used_by_agents && api.used_by_agents.length > 0 ? (
                  <ul className="space-y-2">
                    {api.used_by_agents.map((a) => (
                      <li key={a.id} className="border border-border rounded px-3 py-2 hover:bg-panelHi">
                        <Link
                          to="/agents/$id"
                          params={{ id: String(a.id) }}
                          search={{ view: undefined, id: undefined }}
                          className="text-sm hover:underline"
                        >
                          {a.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">No agents using this yet.</p>
                )}
              </Card>

              {/* 9. Danger zone */}
              <DangerZone
                resourceLabel="API connection"
                confirmName={api.name}
                onDelete={handleDelete}
                busy={deleting}
              />
              <SectionNotice notice={notice} section="danger" />
            </DrawerBody>

            <DrawerFooter>
              <span title={fmtAbsolute(api.created_at)}>Created {fmtRelative(api.created_at)}</span>
              <span title={fmtAbsolute(api.updated_at)}>Updated {fmtRelative(api.updated_at)}</span>
              <span title={fmtAbsolute(api.verified_at)}>Verified {fmtRelative(api.verified_at)}</span>
            </DrawerFooter>
          </>
        )}
      </Drawer>

      {api && (
        <TestCallModal open={testOpen} onClose={() => setTestOpen(false)} api={api} />
      )}
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-md p-4 space-y-3">
      <h3 className="font-display text-base tracking-tightest">{title}</h3>
      {children}
    </section>
  );
}

function DL({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[160px_1fr] gap-y-1.5 gap-x-4 text-sm">{children}</dl>;
}

function DRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted font-sans pt-0.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

function SectionNotice({
  notice,
  section,
}: {
  notice: { section: string; kind: 'ok' | 'err'; msg: string } | null;
  section: string;
}) {
  if (!notice || notice.section !== section) return null;
  return (
    <span
      className={[
        'text-[11px] font-mono',
        notice.kind === 'ok' ? 'text-emerald-700' : 'text-red-700',
      ].join(' ')}
    >
      {notice.msg}
    </span>
  );
}

function DebouncedTextInput({
  value,
  onCommit,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <TextInput
      {...rest}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
