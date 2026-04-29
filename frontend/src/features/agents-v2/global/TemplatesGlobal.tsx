import { useEffect, useState } from 'react';
import { instantiateTemplate, listTemplates } from '../api';
import type { Agent, AgentTemplate } from '../types';
import { Modal } from '../../connectors/components/Modal';
import { Field, TextInput } from '../../connectors/components/Field';
import { JsonEditor } from '../../connectors/components/JsonEditor';
import { PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';
import { EmptyState } from '../../connectors/components/EmptyState';

const GROUPS: Record<string, string[]> = {
  Identity: ['name', 'display_name', 'description', 'type', 'avatar_url', 'color_hex', 'tags'],
  Persona: [
    'system_prompt_template',
    'persona',
    'pinned_context',
    'prompt_variables_json',
    'output_format',
    'output_schema_json',
    'brief',
    'model',
    'temperature',
    'max_tokens',
  ],
  Triggers: [
    'cron_expression',
    'trigger_timezone',
    'run_window',
    'trigger_interval_minutes',
    'trigger_email_address',
    'trigger_api_slug',
    'trigger_supervisor',
    'trigger_table_watch_json',
    'trigger_on_completion_of',
  ],
  Output: [
    'target_table',
    'target_column',
    'edit_mode',
    'output_column',
    'done_column',
    'batch_size',
    'column_map',
    'inbox_kind',
    'reply_mode',
    'log_table',
    'surface_kind',
  ],
  Safety: [
    'max_iterations',
    'max_runtime_seconds',
    'max_tokens_per_run',
    'max_runs_per_day',
    'max_tokens_per_day',
    'max_cost_usd_per_day',
    'max_concurrent_runs',
    'requires_approval_for',
    'approval_route',
    'dry_run',
    'test_mode',
    'on_error_action',
    'circuit_breaker_threshold',
    'allowed_tools',
    'connected_apis',
    'connected_smtp',
    'allowed_outbound_hosts_regex',
  ],
};

function groupDefaults(defaults: Partial<Agent>): Array<{ group: string; entries: Array<[string, unknown]> }> {
  const used = new Set<string>();
  const out: Array<{ group: string; entries: Array<[string, unknown]> }> = [];
  for (const [group, keys] of Object.entries(GROUPS)) {
    const entries: Array<[string, unknown]> = [];
    for (const k of keys) {
      if (k in defaults) {
        entries.push([k, (defaults as Record<string, unknown>)[k]]);
        used.add(k);
      }
    }
    if (entries.length) out.push({ group, entries });
  }
  const extras: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(defaults)) {
    if (!used.has(k)) extras.push([k, v]);
  }
  if (extras.length) out.push({ group: 'Other', entries: extras });
  return out;
}

function ChipRow({ items, max }: { items: string[] | null | undefined; max: number }) {
  if (!items || items.length === 0) return null;
  const shown = items.slice(0, max);
  const more = items.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((c) => (
        <span
          key={c}
          className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans text-muted"
        >
          {c}
        </span>
      ))}
      {more > 0 && (
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
          +{more}
        </span>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onOpen,
  onUse,
}: {
  template: AgentTemplate;
  onOpen: () => void;
  onUse: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left flex flex-col border border-border bg-bg hover:border-fg transition-colors"
    >
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <h3 className="font-display text-base tracking-tightest flex-1">{template.name}</h3>
        <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
          {template.type}
        </span>
      </header>
      <div className="px-4 py-3 flex-1">
        <p className="text-xs text-muted line-clamp-3">{template.description ?? '—'}</p>
      </div>
      <div className="px-4 py-3 space-y-2 border-t border-border">
        <ChipRow items={template.tools_preview ?? null} max={4} />
        <ChipRow items={template.apis_preview ?? null} max={3} />
        <PrimaryButton
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
          className="w-full mt-2"
        >
          Use this template
        </PrimaryButton>
      </div>
    </button>
  );
}

function fmtVal(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v, null, 2);
}

export function TemplatesGlobal() {
  const [items, setItems] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<AgentTemplate | null>(null);
  const [useDialog, setUseDialog] = useState<AgentTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [overrides, setOverrides] = useState<Record<string, unknown> | null>(null);
  const [createdAgent, setCreatedAgent] = useState<Agent | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // TODO: subscribe to templates channel for live updates
      const res = await listTemplates();
      setItems(res.templates);
    } catch (e) {
      setError((e as Error).message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openUse(t: AgentTemplate) {
    setUseDialog(t);
    setNewName(t.name);
    setOverrides(null);
    setCreatedAgent(null);
  }

  async function submitUse() {
    if (!useDialog) return;
    setSubmitting(true);
    try {
      const agent = await instantiateTemplate(useDialog.Id, {
        name: newName,
        overrides: (overrides as Partial<Agent>) ?? undefined,
      });
      setCreatedAgent(agent);
    } catch (e) {
      setError((e as Error).message || 'Failed to instantiate');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mx-6 mt-4 border border-red-600/40 bg-panel px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <SecondaryButton onClick={load}>Retry</SecondaryButton>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-border bg-panel h-48 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <div className="p-6">
          <EmptyState
            title="No templates available"
            body="Templates pre-fill agent configuration. Add some in the backend admin."
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-6">
          {items.map((t) => (
            <TemplateCard
              key={t.Id}
              template={t}
              onOpen={() => setPreview(t)}
              onUse={() => openUse(t)}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        size="lg"
        title={preview ? preview.name : ''}
        footer={
          preview ? (
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setPreview(null)}>Close</SecondaryButton>
              <PrimaryButton
                onClick={() => {
                  const t = preview;
                  setPreview(null);
                  if (t) openUse(t);
                }}
              >
                Use this template
              </PrimaryButton>
            </div>
          ) : null
        }
      >
        {preview && (
          <div className="space-y-4">
            {preview.description && (
              <p className="text-sm text-muted whitespace-pre-wrap">{preview.description}</p>
            )}
            {groupDefaults(preview.defaults_json).map(({ group, entries }) => (
              <section key={group} className="border border-border bg-panel">
                <header className="border-b border-border px-3 py-2">
                  <h4 className="font-display text-sm tracking-tightest uppercase">{group}</h4>
                </header>
                <div className="p-3 space-y-2">
                  {entries.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[180px_1fr] gap-2 text-xs">
                      <span className="font-sans text-muted uppercase tracking-[0.14em]">{k}</span>
                      <pre className="font-mono whitespace-pre-wrap break-words">{fmtVal(v)}</pre>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={!!useDialog}
        onClose={() => {
          setUseDialog(null);
          setCreatedAgent(null);
        }}
        size="lg"
        title={useDialog ? `Instantiate · ${useDialog.name}` : ''}
        footer={
          useDialog ? (
            <div className="flex justify-end gap-2">
              <SecondaryButton
                onClick={() => {
                  setUseDialog(null);
                  setCreatedAgent(null);
                }}
              >
                Close
              </SecondaryButton>
              {!createdAgent && (
                <PrimaryButton onClick={submitUse} disabled={submitting || !newName.trim()}>
                  {submitting ? 'Creating…' : 'Create agent'}
                </PrimaryButton>
              )}
            </div>
          ) : null
        }
      >
        {useDialog && !createdAgent && (
          <div className="space-y-3">
            <Field label="New agent name" required>
              <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} />
            </Field>
            <Field label="Overrides (JSON)" hint="Merged on top of template defaults.">
              <JsonEditor value={overrides} onChange={(v) => setOverrides(v as Record<string, unknown> | null)} />
            </Field>
          </div>
        )}
        {createdAgent && (
          <div className="space-y-3">
            <p className="text-sm">
              Agent <strong>{createdAgent.name}</strong> created.
            </p>
            <a
              href={`/agents?id=${createdAgent.Id}`}
              className="inline-block border border-fg bg-fg text-bg px-3 py-2 text-[11px] uppercase tracking-[0.18em] font-sans"
            >
              Open agent →
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}
