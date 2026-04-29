import { useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, OutputFormat } from '../types';
import { fetchModelList, patchAgent } from '../api';
import { Field, SelectInput, TextArea, TextInput, Toggle } from '../../connectors/components/Field';
import { JsonEditor } from '../../connectors/components/JsonEditor';
import { PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';

type CardKey = 'identity' | 'persona' | 'model' | 'memory' | 'brief';

function Card({
  k,
  title,
  open,
  onToggle,
  children,
}: {
  k: CardKey;
  title: string;
  open: boolean;
  onToggle: (k: CardKey) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-panel">
      <button
        type="button"
        onClick={() => onToggle(k)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-panelHi"
      >
        <h3 className="font-display text-sm tracking-tightest uppercase">{title}</h3>
        <span className="text-muted text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </section>
  );
}

function CardFooter({
  dirty,
  busy,
  onSave,
  onDiscard,
  saveLabel = 'Save changes',
}: {
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="border-t border-border mt-4 pt-3 flex items-center justify-end gap-2">
      <SecondaryButton disabled={!dirty || busy} onClick={onDiscard}>
        Discard
      </SecondaryButton>
      <PrimaryButton disabled={!dirty || busy} onClick={onSave}>
        {busy ? 'Saving…' : saveLabel}
      </PrimaryButton>
    </div>
  );
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

export function ConfigureTab({
  agent,
  onChanged,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
}) {
  const [openCards, setOpenCards] = useState<Record<CardKey, boolean>>({
    identity: true,
    persona: true,
    model: false,
    memory: false,
    brief: false,
  });
  const toggle = (k: CardKey) => setOpenCards((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className="p-6 space-y-4">
      <IdentityCard agent={agent} onChanged={onChanged} open={openCards.identity} onToggle={toggle} />
      <PersonaCard agent={agent} onChanged={onChanged} open={openCards.persona} onToggle={toggle} />
      <ModelCard agent={agent} onChanged={onChanged} open={openCards.model} onToggle={toggle} />
      <MemoryCard agent={agent} onChanged={onChanged} open={openCards.memory} onToggle={toggle} />
      <BriefCard agent={agent} onChanged={onChanged} open={openCards.brief} onToggle={toggle} />
    </div>
  );
}

// ---------- Identity ----------

interface IdentityForm {
  name: string;
  description: string;
  avatar_url: string;
  color_hex: string;
  tags: string[];
}
function identityFromAgent(a: Agent): IdentityForm {
  return {
    name: a.name ?? '',
    description: a.description ?? '',
    avatar_url: a.avatar_url ?? '',
    color_hex: a.color_hex ?? '#0a0a0a',
    tags: a.tags ?? [],
  };
}

function IdentityCard({
  agent,
  onChanged,
  open,
  onToggle,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
  open: boolean;
  onToggle: (k: CardKey) => void;
}) {
  const [form, setForm] = useState<IdentityForm>(() => identityFromAgent(agent));
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm(identityFromAgent(agent));
  }, [agent]);

  const dirty = !shallowEqual(form, identityFromAgent(agent));

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] });
    setTagInput('');
  }
  function removeTag(t: string) {
    setForm({ ...form, tags: form.tags.filter((x) => x !== t) });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const next = await patchAgent(agent.Id, {
        name: form.name,
        description: form.description || null,
        avatar_url: form.avatar_url || null,
        color_hex: form.color_hex || null,
        tags: form.tags.length ? form.tags : null,
      });
      onChanged(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card k="identity" title="Identity" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <TextArea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Avatar URL">
          <TextInput
            type="url"
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
          />
        </Field>
        <Field label="Color">
          <input
            type="color"
            value={form.color_hex}
            onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
            className="h-9 w-16 border border-border bg-bg"
          />
        </Field>
        <Field label="Tags" hint="Press Enter to add a tag.">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 bg-panelHi border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-muted hover:text-fg"
                    aria-label={`Remove tag ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <TextInput
              value={tagInput}
              placeholder="Add tag and press Enter"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
          </div>
        </Field>
        <Field label="Org ID">
          <TextInput value={agent.org_id != null ? String(agent.org_id) : ''} readOnly disabled />
        </Field>
        {err && <p className="text-xs text-red-700">{err}</p>}
        <CardFooter
          dirty={dirty}
          busy={busy}
          onSave={save}
          onDiscard={() => setForm(identityFromAgent(agent))}
        />
      </div>
    </Card>
  );
}

// ---------- Persona & Prompt ----------

interface PersonaForm {
  system_prompt_template: string;
  persona: string;
  pinned_context: string;
  prompt_variables_json: Record<string, unknown> | null;
  output_format: OutputFormat;
  output_schema_json: Record<string, unknown> | null;
}
function personaFromAgent(a: Agent): PersonaForm {
  return {
    system_prompt_template: a.system_prompt_template ?? '',
    persona: a.persona ?? '',
    pinned_context: a.pinned_context ?? '',
    prompt_variables_json: (a.prompt_variables_json ?? null) as Record<string, unknown> | null,
    output_format: (a.output_format ?? 'markdown') as OutputFormat,
    output_schema_json: (a.output_schema_json ?? null) as Record<string, unknown> | null,
  };
}

function PersonaCard({
  agent,
  onChanged,
  open,
  onToggle,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
  open: boolean;
  onToggle: (k: CardKey) => void;
}) {
  const [form, setForm] = useState<PersonaForm>(() => personaFromAgent(agent));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm(personaFromAgent(agent));
  }, [agent]);

  const dirty = !shallowEqual(form, personaFromAgent(agent));
  const charCount = form.system_prompt_template.length;
  const tokenEst = Math.ceil(charCount / 4);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const next = await patchAgent(agent.Id, {
        system_prompt_template: form.system_prompt_template || null,
        persona: form.persona || null,
        pinned_context: form.pinned_context || null,
        prompt_variables_json: (form.prompt_variables_json ?? null) as Record<string, unknown> | null,
        output_format: form.output_format,
        output_schema_json: (form.output_schema_json ?? null) as Record<string, unknown> | null,
      });
      onChanged(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card k="persona" title="Persona & Prompt" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <Field
          label="System prompt template"
          hint={`${charCount} chars · ~${tokenEst} tokens`}
        >
          <TextArea
            rows={12}
            className="font-mono text-xs"
            value={form.system_prompt_template}
            onChange={(e) => setForm({ ...form, system_prompt_template: e.target.value })}
          />
        </Field>
        <Field label="Persona">
          <TextArea
            rows={6}
            className="font-mono text-xs"
            value={form.persona}
            onChange={(e) => setForm({ ...form, persona: e.target.value })}
          />
        </Field>
        <Field label="Pinned context" hint="Always prepended to every run.">
          <TextArea
            rows={6}
            className="font-mono text-xs"
            value={form.pinned_context}
            onChange={(e) => setForm({ ...form, pinned_context: e.target.value })}
          />
        </Field>
        <Field label="Prompt variables">
          <JsonEditor
            value={form.prompt_variables_json}
            onChange={(v) =>
              setForm({ ...form, prompt_variables_json: (v ?? null) as Record<string, unknown> | null })
            }
            schemaHint="Optional record of {key: value} pairs"
          />
        </Field>
        <Field label="Output format">
          <div className="flex flex-wrap gap-3">
            {(['markdown', 'json', 'html', 'plain'] as OutputFormat[]).map((f) => (
              <label key={f} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`output_format-${agent.Id}`}
                  value={f}
                  checked={form.output_format === f}
                  onChange={() => setForm({ ...form, output_format: f })}
                />
                <span className="uppercase tracking-[0.14em] text-xs">{f}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Output schema">
          <JsonEditor
            value={form.output_schema_json}
            onChange={(v) =>
              setForm({ ...form, output_schema_json: (v ?? null) as Record<string, unknown> | null })
            }
            schemaHint="Optional JSON schema describing expected output"
          />
        </Field>
        <Field
          label="Prompt version"
          hint="Saving persona / prompt / pinned_context auto-bumps this."
        >
          <TextInput value={`v${agent.prompt_version ?? 1}`} readOnly disabled />
        </Field>
        {err && <p className="text-xs text-red-700">{err}</p>}
        <CardFooter
          dirty={dirty}
          busy={busy}
          onSave={save}
          onDiscard={() => setForm(personaFromAgent(agent))}
        />
      </div>
    </Card>
  );
}

// ---------- Model ----------

interface ModelForm {
  model: string;
  temperature: number;
  max_tokens: number | null;
  fallback_model: string;
}
function modelFromAgent(a: Agent): ModelForm {
  return {
    model: a.model ?? '',
    temperature: a.temperature ?? 0.7,
    max_tokens: a.max_tokens ?? null,
    fallback_model: a.fallback_model ?? '',
  };
}

function ModelCard({
  agent,
  onChanged,
  open,
  onToggle,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
  open: boolean;
  onToggle: (k: CardKey) => void;
}) {
  const [form, setForm] = useState<ModelForm>(() => modelFromAgent(agent));
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm(modelFromAgent(agent));
  }, [agent]);

  useEffect(() => {
    let cancelled = false;
    void fetchModelList().then((list) => {
      if (!cancelled) setModels(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = !shallowEqual(form, modelFromAgent(agent));

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const next = await patchAgent(agent.Id, {
        model: form.model || null,
        temperature: form.temperature,
        max_tokens: form.max_tokens,
        fallback_model: form.fallback_model || null,
      });
      onChanged(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const hasModels = models.length > 0;

  return (
    <Card k="model" title="Model" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <Field label="Model">
          {hasModels ? (
            <SelectInput value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
              <option value="">— select —</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          ) : (
            <TextInput value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          )}
        </Field>
        <Field label={`Temperature (${form.temperature.toFixed(2)})`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        <Field label="Max tokens">
          <TextInput
            type="number"
            value={form.max_tokens ?? ''}
            onChange={(e) =>
              setForm({ ...form, max_tokens: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Fallback model">
          {hasModels ? (
            <SelectInput
              value={form.fallback_model}
              onChange={(e) => setForm({ ...form, fallback_model: e.target.value })}
            >
              <option value="">— none —</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          ) : (
            <TextInput
              value={form.fallback_model}
              onChange={(e) => setForm({ ...form, fallback_model: e.target.value })}
            />
          )}
        </Field>
        {err && <p className="text-xs text-red-700">{err}</p>}
        <CardFooter
          dirty={dirty}
          busy={busy}
          onSave={save}
          onDiscard={() => setForm(modelFromAgent(agent))}
        />
      </div>
    </Card>
  );
}

// ---------- Memory / RAG ----------

interface MemoryForm {
  rag_enabled: boolean;
  rag_collection: string;
  rag_n_candidates: number | null;
  rag_top_k: number | null;
  rag_scope_filter_json: Record<string, unknown> | null;
}
function memoryFromAgent(a: Agent): MemoryForm {
  return {
    rag_enabled: a.rag_enabled ?? false,
    rag_collection: a.rag_collection ?? '',
    rag_n_candidates: a.rag_n_candidates ?? null,
    rag_top_k: a.rag_top_k ?? null,
    rag_scope_filter_json: (a.rag_scope_filter_json ?? null) as Record<string, unknown> | null,
  };
}

function MemoryCard({
  agent,
  onChanged,
  open,
  onToggle,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
  open: boolean;
  onToggle: (k: CardKey) => void;
}) {
  const [form, setForm] = useState<MemoryForm>(() => memoryFromAgent(agent));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm(memoryFromAgent(agent));
  }, [agent]);

  const dirty = !shallowEqual(form, memoryFromAgent(agent));

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const next = await patchAgent(agent.Id, {
        rag_enabled: form.rag_enabled,
        rag_collection: form.rag_collection || null,
        rag_n_candidates: form.rag_n_candidates,
        rag_top_k: form.rag_top_k,
        rag_scope_filter_json: form.rag_scope_filter_json,
      });
      onChanged(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card k="memory" title="Memory (RAG)" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <Field label="RAG enabled">
          <Toggle checked={form.rag_enabled} onChange={(v) => setForm({ ...form, rag_enabled: v })} />
        </Field>
        {form.rag_enabled && (
          <>
            <Field label="Collection">
              <TextInput
                value={form.rag_collection}
                onChange={(e) => setForm({ ...form, rag_collection: e.target.value })}
              />
            </Field>
            <Field label="N candidates">
              <TextInput
                type="number"
                value={form.rag_n_candidates ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rag_n_candidates: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Top K">
              <TextInput
                type="number"
                value={form.rag_top_k ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rag_top_k: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Scope filter">
              <JsonEditor
                value={form.rag_scope_filter_json}
                onChange={(v) =>
                  setForm({
                    ...form,
                    rag_scope_filter_json: (v ?? null) as Record<string, unknown> | null,
                  })
                }
                schemaHint="Optional filter applied to RAG queries"
              />
            </Field>
          </>
        )}
        {err && <p className="text-xs text-red-700">{err}</p>}
        <CardFooter
          dirty={dirty}
          busy={busy}
          onSave={save}
          onDiscard={() => setForm(memoryFromAgent(agent))}
        />
      </div>
    </Card>
  );
}

// ---------- Brief ----------

function BriefCard({
  agent,
  onChanged,
  open,
  onToggle,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
  open: boolean;
  onToggle: (k: CardKey) => void;
}) {
  const [brief, setBrief] = useState<string>(agent.brief ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBrief(agent.brief ?? '');
  }, [agent]);

  const dirty = useMemo(() => brief !== (agent.brief ?? ''), [brief, agent.brief]);

  async function doSave(value: string) {
    setBusy(true);
    setErr(null);
    try {
      const next = await patchAgent(agent.Id, { brief: value || null });
      onChanged(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onBlur() {
    if (!dirty) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSave(brief);
    }, 1000);
  }

  return (
    <Card k="brief" title="Brief & Assignment" open={open} onToggle={onToggle}>
      <div className="space-y-3">
        <Field label="Brief">
          <TextArea
            rows={10}
            className="font-mono text-xs"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onBlur={onBlur}
          />
        </Field>
        <p className="text-[11px] text-muted">
          Editing the brief is how you reassign this agent. History preserved.
        </p>
        {err && <p className="text-xs text-red-700">{err}</p>}
        <CardFooter
          dirty={dirty}
          busy={busy}
          onSave={() => void doSave(brief)}
          onDiscard={() => setBrief(agent.brief ?? '')}
          saveLabel="Save brief"
        />
      </div>
    </Card>
  );
}
