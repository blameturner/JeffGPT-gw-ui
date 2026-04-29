import { useEffect, useState } from 'react';
import type { Agent, AgentTemplate, AgentType, InboxKind, ReplyMode } from '../types';
import { createAgent, fetchModelList, instantiateTemplate, listTemplates } from '../api';
import { Modal } from '../../connectors/components/Modal';
import { Field, SelectInput, TextArea, TextInput, Toggle } from '../../connectors/components/Field';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';

const TYPES: { id: AgentType; label: string; description: string }[] = [
  { id: 'document', label: 'Document', description: 'Edits a single cell or document.' },
  { id: 'queue', label: 'Queue', description: 'Processes rows of a queue table.' },
  { id: 'producer', label: 'Producer', description: 'Generates new rows on a schedule.' },
  { id: 'responder', label: 'Responder', description: 'Replies to inbound emails / API calls.' },
  { id: 'supervisor', label: 'Supervisor', description: 'Orchestrates other agents.' },
];

interface FormState {
  name: string;
  type: AgentType;
  description: string;
  color_hex: string;
  startFromTemplate: boolean;
  templateId: number | null;
  persona: string;
  system_prompt_template: string;
  brief: string;
  model: string;
  temperature: number;
  max_tokens: number | null;
  // type-specific
  target_table: string;
  target_row_id: string;
  target_column: string;
  output_column: string;
  batch_size: number | null;
  inbox_kind: InboxKind;
  reply_mode: ReplyMode;
}

const DEFAULT_FORM: FormState = {
  name: '',
  type: 'document',
  description: '',
  color_hex: '#0a0a0a',
  startFromTemplate: false,
  templateId: null,
  persona: '',
  system_prompt_template: '',
  brief: '',
  model: '',
  temperature: 0.7,
  max_tokens: null,
  target_table: '',
  target_row_id: '',
  target_column: '',
  output_column: '',
  batch_size: null,
  inbox_kind: 'email',
  reply_mode: 'approval',
};

export function NewAgentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm(DEFAULT_FORM);
    setErr(null);
    void listTemplates()
      .then((res) => setTemplates(res.templates))
      .catch(() => setTemplates([]));
    void fetchModelList().then(setModels);
  }, [open]);

  function applyTemplate(tpl: AgentTemplate) {
    const d = tpl.defaults_json ?? {};
    setForm((prev) => ({
      ...prev,
      templateId: tpl.Id,
      type: tpl.type,
      name: prev.name || tpl.name,
      description: (d.description as string | undefined) ?? prev.description,
      persona: (d.persona as string | undefined) ?? prev.persona,
      system_prompt_template: (d.system_prompt_template as string | undefined) ?? prev.system_prompt_template,
      brief: (d.brief as string | undefined) ?? prev.brief,
      model: (d.model as string | undefined) ?? prev.model,
      temperature: (d.temperature as number | undefined) ?? prev.temperature,
      max_tokens: (d.max_tokens as number | undefined) ?? prev.max_tokens,
    }));
    setStep(2);
  }

  function validateStep(s: 1 | 2 | 3): string | null {
    if (s === 1) {
      if (!form.name.trim()) return 'Name is required.';
      if (!form.type) return 'Type is required.';
    }
    if (s === 2) {
      // Optional but at least one of system prompt or persona is good practice — not strictly required.
    }
    return null;
  }

  function next() {
    const e = validateStep(step);
    if (e) {
      setErr(e);
      return;
    }
    setErr(null);
    if (step < 3) setStep((step + 1) as 1 | 2 | 3);
  }
  function back() {
    setErr(null);
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  }

  async function submit() {
    const e1 = validateStep(1);
    if (e1) {
      setErr(e1);
      setStep(1);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const overrides: Partial<Agent> = {
        name: form.name,
        type: form.type,
        description: form.description || null,
        color_hex: form.color_hex || null,
        persona: form.persona || null,
        system_prompt_template: form.system_prompt_template || null,
        brief: form.brief || null,
        model: form.model || null,
        temperature: form.temperature,
        max_tokens: form.max_tokens,
      };

      // Type-specific
      if (form.type === 'document') {
        overrides.target_table = form.target_table || null;
        overrides.target_row_id = form.target_row_id ? Number(form.target_row_id) : null;
        overrides.target_column = form.target_column || null;
      } else if (form.type === 'queue') {
        overrides.target_table = form.target_table || null;
        overrides.output_column = form.output_column || null;
        overrides.batch_size = form.batch_size;
      } else if (form.type === 'producer') {
        overrides.target_table = form.target_table || null;
      } else if (form.type === 'responder') {
        overrides.inbox_kind = form.inbox_kind;
        overrides.reply_mode = form.reply_mode;
      }

      let agent: Agent;
      if (form.startFromTemplate && form.templateId != null) {
        agent = await instantiateTemplate(form.templateId, { name: form.name, overrides });
      } else {
        agent = await createAgent(overrides);
      }
      onCreated(agent.Id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-3">
          <span>New agent</span>
          <span className="text-xs font-mono text-muted">
            Step {step} / 3
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <SecondaryButton onClick={back} disabled={busy}>
                Back
              </SecondaryButton>
            )}
            {step < 3 ? (
              <PrimaryButton onClick={next} disabled={busy}>
                Next
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={submit} disabled={busy}>
                {busy ? 'Creating…' : 'Create agent'}
              </PrimaryButton>
            )}
          </div>
        </div>
      }
    >
      {err && <p className="mb-3 text-xs text-red-700">{err}</p>}

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Name" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <label
                  key={t.id}
                  className={[
                    'border p-3 cursor-pointer flex items-start gap-3',
                    form.type === t.id ? 'border-fg bg-panelHi' : 'border-border bg-panel hover:border-fg',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="agent-type"
                    value={t.id}
                    checked={form.type === t.id}
                    onChange={() => setForm({ ...form, type: t.id })}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <div className="font-display text-sm tracking-tightest uppercase">{t.label}</div>
                    <div className="text-xs text-muted">{t.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Description">
            <TextArea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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

          <Field label="Start from template">
            <Toggle
              checked={form.startFromTemplate}
              onChange={(v) => setForm({ ...form, startFromTemplate: v, templateId: v ? form.templateId : null })}
            />
          </Field>

          {form.startFromTemplate && (
            <div className="border border-border bg-panel p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Templates</div>
              {templates.length === 0 ? (
                <p className="text-xs text-muted">No templates available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.Id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={[
                        'text-left border p-3',
                        form.templateId === tpl.Id ? 'border-fg bg-panelHi' : 'border-border hover:border-fg',
                      ].join(' ')}
                    >
                      <div className="font-display text-sm tracking-tightest uppercase">{tpl.name}</div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{tpl.type}</div>
                      {tpl.description && (
                        <div className="text-xs text-muted mt-1 line-clamp-3">{tpl.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Field label="Persona">
            <TextArea
              rows={5}
              className="font-mono text-xs"
              value={form.persona}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
            />
          </Field>
          <Field label="System prompt template">
            <TextArea
              rows={8}
              className="font-mono text-xs"
              value={form.system_prompt_template}
              onChange={(e) => setForm({ ...form, system_prompt_template: e.target.value })}
            />
          </Field>
          <Field label="Brief">
            <TextArea
              rows={5}
              className="font-mono text-xs"
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
            />
          </Field>
          <Field label="Model">
            {models.length > 0 ? (
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
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="border border-border bg-panel px-3 py-2 text-xs text-muted">
            Configure type-specific options after creation in the Artifact / Output tab.
          </div>

          {form.type === 'document' && (
            <>
              <Field label="Target table">
                <TextInput
                  value={form.target_table}
                  onChange={(e) => setForm({ ...form, target_table: e.target.value })}
                />
              </Field>
              <Field label="Target row ID">
                <TextInput
                  type="number"
                  value={form.target_row_id}
                  onChange={(e) => setForm({ ...form, target_row_id: e.target.value })}
                />
              </Field>
              <Field label="Target column">
                <TextInput
                  value={form.target_column}
                  onChange={(e) => setForm({ ...form, target_column: e.target.value })}
                />
              </Field>
            </>
          )}

          {form.type === 'queue' && (
            <>
              <Field label="Target table">
                <TextInput
                  value={form.target_table}
                  onChange={(e) => setForm({ ...form, target_table: e.target.value })}
                />
              </Field>
              <Field label="Output column">
                <TextInput
                  value={form.output_column}
                  onChange={(e) => setForm({ ...form, output_column: e.target.value })}
                />
              </Field>
              <Field label="Batch size">
                <TextInput
                  type="number"
                  value={form.batch_size ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, batch_size: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </Field>
            </>
          )}

          {form.type === 'producer' && (
            <Field label="Target table">
              <TextInput
                value={form.target_table}
                onChange={(e) => setForm({ ...form, target_table: e.target.value })}
              />
            </Field>
          )}

          {form.type === 'responder' && (
            <>
              <Field label="Inbox kind">
                <div className="flex gap-3">
                  {(['email', 'api', 'conversation'] as InboxKind[]).map((k) => (
                    <label key={k} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="inbox_kind"
                        value={k}
                        checked={form.inbox_kind === k}
                        onChange={() => setForm({ ...form, inbox_kind: k })}
                      />
                      <span className="uppercase tracking-[0.14em] text-xs">{k}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Reply mode">
                <div className="flex gap-3">
                  {(['auto', 'approval', 'none'] as ReplyMode[]).map((k) => (
                    <label key={k} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="reply_mode"
                        value={k}
                        checked={form.reply_mode === k}
                        onChange={() => setForm({ ...form, reply_mode: k })}
                      />
                      <span className="uppercase tracking-[0.14em] text-xs">{k}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}

          {form.type === 'supervisor' && (
            <p className="text-xs text-muted">
              Supervisors orchestrate other agents. Configure the team after creation.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
