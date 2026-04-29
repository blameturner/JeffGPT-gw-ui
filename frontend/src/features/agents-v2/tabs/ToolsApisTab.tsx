import { useEffect, useMemo, useState } from 'react';
import type { Agent, ToolCatalogEntry } from '../types';
import { fetchToolCatalog, patchAgent } from '../api';
import { Field, TextArea } from '../../connectors/components/Field';
import { JsonEditor } from '../../connectors/components/JsonEditor';
import {
  PrimaryButton,
  GhostButton,
} from '../../connectors/components/Toolbar';
import { ToolPicker } from '../components/ToolPicker';
import { ApiPicker } from '../components/ApiPicker';
import { SmtpPicker } from '../components/SmtpPicker';
import { SecretPicker } from '../components/SecretPicker';
import { TablePicker } from '../components/TablePicker';
import { RegexInput } from '../components/RegexInput';

function diff(a: Agent, b: Agent): Partial<Agent> {
  const out: Partial<Agent> = {};
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === 'Id') continue;
    if (
      JSON.stringify((a as Record<string, unknown>)[k]) !==
      JSON.stringify((b as Record<string, unknown>)[k])
    ) {
      (out as Record<string, unknown>)[k] = (b as Record<string, unknown>)[k];
    }
  }
  return out;
}

function Card({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-panel">
      <header className="border-b border-border px-4 py-2">
        <h3 className="font-display text-sm tracking-tightest uppercase">{title}</h3>
        {helper && <p className="text-[11px] text-muted mt-0.5">{helper}</p>}
      </header>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

export function ToolsApisTab({
  agent,
  onChanged,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
}) {
  const [draft, setDraft] = useState<Agent>(agent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<ToolCatalogEntry[] | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);

  if (agent.Id !== draft.Id) {
    setDraft(agent);
  }

  useEffect(() => {
    let alive = true;
    fetchToolCatalog()
      .then((res) => {
        if (!alive) return;
        if (res.length === 0) setCatalogFailed(true);
        setCatalog(res);
      })
      .catch(() => {
        if (!alive) return;
        setCatalogFailed(true);
        setCatalog([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(() => Object.keys(diff(agent, draft)).length > 0, [agent, draft]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const patch = diff(agent, draft);
      const res = await patchAgent(agent.Id, patch);
      onChanged(res);
      setDraft(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function discard() {
    setDraft(agent);
    setError(null);
  }

  // NocoDB validation: a table cannot appear in both read/write and forbidden.
  const reads = draft.allowed_tables_read ?? [];
  const writes = draft.allowed_tables_write ?? [];
  const forbidden = draft.forbidden_tables ?? [];
  const conflicts = forbidden.filter((t) => reads.includes(t) || writes.includes(t));

  return (
    <div className="p-6 space-y-4 pb-32">
      <Card title="Tools">
        {catalog == null ? (
          <div className="text-xs text-muted">Loading…</div>
        ) : catalogFailed || catalog.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Tool catalog unavailable — paste tool names below (comma-separated).
            </p>
            <TextArea
              rows={3}
              value={(draft.allowed_tools ?? []).join(', ')}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  allowed_tools: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              className="font-mono"
            />
          </div>
        ) : (
          <ToolPicker
            catalog={catalog}
            value={draft.allowed_tools ?? []}
            onChange={(v) => setDraft((d) => ({ ...d, allowed_tools: v }))}
          />
        )}
        <Field label="Tool config">
          <JsonEditor
            value={draft.tool_config_json ?? null}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                tool_config_json: (v as Record<string, unknown> | null) ?? null,
              }))
            }
            schemaHint="Per-tool config keyed by tool name"
          />
        </Field>
      </Card>

      <Card
        title="Connected APIs"
        helper="Agents call these via the http_request tool. Use the connection name as the connection arg."
      >
        <ApiPicker
          value={draft.connected_apis ?? []}
          onChange={(v) => setDraft((d) => ({ ...d, connected_apis: v }))}
        />
      </Card>

      <Card
        title="Connected SMTP"
        helper="Agents send via the send_email tool referencing one of these."
      >
        <SmtpPicker
          value={draft.connected_smtp ?? []}
          onChange={(v) => setDraft((d) => ({ ...d, connected_smtp: v }))}
        />
      </Card>

      <Card
        title="Connected secrets"
        helper="Tools can reference these by name when this agent runs."
      >
        <SecretPicker
          value={draft.connected_secrets ?? []}
          onChange={(v) => setDraft((d) => ({ ...d, connected_secrets: v }))}
        />
      </Card>

      <Card title="NocoDB access">
        <Field label="Allowed tables (read)">
          <TablePicker
            multi
            value={reads}
            onChange={(v) => setDraft((d) => ({ ...d, allowed_tables_read: v }))}
          />
        </Field>
        <Field label="Allowed tables (write)">
          <TablePicker
            multi
            value={writes}
            onChange={(v) => setDraft((d) => ({ ...d, allowed_tables_write: v }))}
          />
        </Field>
        <Field
          label="Forbidden tables"
          hint="Takes precedence over read/write."
          error={
            conflicts.length > 0
              ? `Conflict: ${conflicts.join(', ')} appear in both forbidden and read/write.`
              : undefined
          }
        >
          <TablePicker
            multi
            value={forbidden}
            onChange={(v) => setDraft((d) => ({ ...d, forbidden_tables: v }))}
          />
        </Field>
      </Card>

      <Card title="Outbound network">
        <Field
          label="Allowed outbound hosts (regex)"
          hint="Only requests matching this regex are allowed."
        >
          <RegexInput
            value={draft.allowed_outbound_hosts_regex}
            onChange={(v) =>
              setDraft((d) => ({ ...d, allowed_outbound_hosts_regex: v }))
            }
          />
        </Field>
      </Card>

      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-bg px-6 py-3 flex items-center gap-3">
          {error && <span className="text-xs text-red-700">{error}</span>}
          <span className="text-xs text-muted">Unsaved changes</span>
          <div className="ml-auto flex items-center gap-2">
            <GhostButton type="button" onClick={discard} disabled={saving}>
              Discard
            </GhostButton>
            <PrimaryButton
              type="button"
              onClick={save}
              disabled={saving || conflicts.length > 0}
            >
              {saving ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
