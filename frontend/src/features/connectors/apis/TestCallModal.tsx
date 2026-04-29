import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { Field, SelectInput, TextInput } from '../components/Field';
import { JsonEditor } from '../components/JsonEditor';
import { TestResultCard } from '../components/TestResultCard';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Toolbar';
import { testCallApi } from '../api';
import type { ApiConnection, HttpMethod, TestCallResult } from '../types';

interface KV {
  key: string;
  value: string;
}

const DEFAULT_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface PersistedRequest {
  method: HttpMethod;
  path: string;
  params: KV[];
  headers: KV[];
  body: Record<string, unknown> | unknown[] | null;
}

function storageKey(id: number) {
  return `connector.api.${id}.lastTest`;
}

function loadPersisted(id: number): Partial<PersistedRequest> | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedRequest>;
  } catch {
    return null;
  }
}

export function TestCallModal({
  open,
  onClose,
  api,
}: {
  open: boolean;
  onClose: () => void;
  api: ApiConnection;
}) {
  const allowed = useMemo<HttpMethod[]>(
    () => (api.allowed_methods && api.allowed_methods.length ? api.allowed_methods : DEFAULT_METHODS),
    [api.allowed_methods],
  );

  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState('/');
  const [params, setParams] = useState<KV[]>([{ key: '', value: '' }]);
  const [headers, setHeaders] = useState<KV[]>([{ key: '', value: '' }]);
  const [body, setBody] = useState<Record<string, unknown> | unknown[] | null>(null);
  const [tab, setTab] = useState<'params' | 'headers' | 'body'>('params');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestCallResult | null>(null);

  // Hydrate from localStorage on open.
  useEffect(() => {
    if (!open) return;
    const persisted = loadPersisted(api.id);
    if (persisted) {
      if (persisted.method && allowed.includes(persisted.method)) setMethod(persisted.method);
      else setMethod(allowed[0] ?? 'GET');
      if (typeof persisted.path === 'string') setPath(persisted.path);
      if (Array.isArray(persisted.params)) setParams(persisted.params.length ? persisted.params : [{ key: '', value: '' }]);
      if (Array.isArray(persisted.headers)) setHeaders(persisted.headers.length ? persisted.headers : [{ key: '', value: '' }]);
      if (persisted.body !== undefined) setBody(persisted.body ?? null);
    } else {
      setMethod(allowed[0] ?? 'GET');
      setPath('/');
      setParams([{ key: '', value: '' }]);
      setHeaders([{ key: '', value: '' }]);
      setBody(null);
    }
    setResult(null);
    setError(null);
  }, [open, api.id, allowed]);

  // Persist on change (request only).
  useEffect(() => {
    if (!open) return;
    const payload: PersistedRequest = { method, path, params, headers, body };
    try {
      localStorage.setItem(storageKey(api.id), JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [open, api.id, method, path, params, headers, body]);

  const showBody = method === 'POST' || method === 'PUT' || method === 'PATCH';

  const examplePath = useMemo(() => {
    const sample = api.inspection_summary_json?.openapi?.summary?.endpoints_sample;
    if (!sample || sample.length === 0) return '';
    return sample
      .slice(0, 3)
      .map((e) => `${e.method} ${e.path}`)
      .join('  ·  ');
  }, [api.inspection_summary_json]);

  function kvToRecord(rows: KV[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of rows) {
      const k = row.key.trim();
      if (!k) continue;
      out[k] = row.value;
    }
    return out;
  }

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await testCallApi(api.id, {
        method,
        path,
        params: kvToRecord(params),
        headers: kvToRecord(headers),
        body: showBody ? body : undefined,
      });
      setResult(res);
    } catch (e) {
      console.error('test-call failed', e);
      setError((e as Error).message || 'Test call failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Test call: ${api.name}`}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={busy}>
            Close
          </SecondaryButton>
          <PrimaryButton onClick={send} disabled={busy || !path.trim()}>
            {busy ? 'Sending…' : 'Send'}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[140px_1fr] gap-3">
          <Field label="Method">
            <SelectInput value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)}>
              {allowed.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Path" hint={examplePath ? `e.g. ${examplePath}` : 'Relative path appended to base_url'}>
            <TextInput
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/users/me"
              className="font-mono"
            />
          </Field>
        </div>

        <div className="border-b border-border flex gap-1">
          {(['params', 'headers', 'body'] as const).map((t) => {
            if (t === 'body' && !showBody) return null;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  'px-3 py-2 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
                  tab === t ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
                ].join(' ')}
              >
                {t}
              </button>
            );
          })}
        </div>

        {tab === 'params' && <KvEditor rows={params} onChange={setParams} />}
        {tab === 'headers' && <KvEditor rows={headers} onChange={setHeaders} />}
        {tab === 'body' && showBody && (
          <JsonEditor
            value={body}
            onChange={(v) => setBody(v)}
            rows={10}
            schemaHint="JSON request body"
          />
        )}

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2 rounded">
            {error}
          </div>
        )}

        {result && (
          <TestResultCard
            statusCode={result.status_code}
            statusText={result.status_text}
            durationMs={result.duration_ms}
            headers={result.headers}
            body={result.body}
          />
        )}
      </div>
    </Modal>
  );
}

function KvEditor({ rows, onChange }: { rows: KV[]; onChange: (next: KV[]) => void }) {
  function update(idx: number, patch: Partial<KV>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function remove(idx: number) {
    const next = rows.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ key: '', value: '' }]);
  }
  function add() {
    onChange([...rows, { key: '', value: '' }]);
  }
  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <TextInput
            value={row.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            placeholder="key"
            className="font-mono"
          />
          <TextInput
            value={row.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="value"
            className="font-mono"
          />
          <GhostButton type="button" onClick={() => remove(idx)} aria-label="Remove row">
            ×
          </GhostButton>
        </div>
      ))}
      <SecondaryButton type="button" onClick={add}>
        + Add row
      </SecondaryButton>
    </div>
  );
}
