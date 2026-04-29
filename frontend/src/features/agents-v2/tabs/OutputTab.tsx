import { useMemo, useState } from 'react';
import type { Agent } from '../types';
import { patchAgent } from '../api';
import { Field, TextInput, Toggle } from '../../connectors/components/Field';
import {
  PrimaryButton,
  GhostButton,
} from '../../connectors/components/Toolbar';
import { TypeConfigPanel } from '../components/TypeConfigPanel';

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-panel">
      <header className="border-b border-border px-4 py-2">
        <h3 className="font-display text-sm tracking-tightest uppercase">{title}</h3>
      </header>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

export function OutputTab({
  agent,
  onChanged,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
}) {
  const [draft, setDraft] = useState<Agent>(agent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (agent.Id !== draft.Id) {
    setDraft(agent);
  }

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

  const conf = draft.confidence_threshold ?? 0.7;

  return (
    <div className="p-6 space-y-4 pb-32">
      <Card title={`${draft.type} configuration`}>
        <TypeConfigPanel draft={draft} setDraft={(mut) => setDraft(mut)} />
      </Card>

      <Card title="Common output settings">
        <Field
          label="Reflect"
          hint="Pass output through self-critique before commit"
        >
          <Toggle
            checked={!!draft.reflect}
            onChange={(v) => setDraft((d) => ({ ...d, reflect: v }))}
          />
        </Field>
        <Field
          label="Confidence threshold"
          hint="Below this, route to approval queue"
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={conf}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  confidence_threshold: Number(e.target.value),
                }))
              }
              className="flex-1"
            />
            <span className="font-mono text-xs w-12 text-right">{conf.toFixed(2)}</span>
          </div>
        </Field>
        <Field label="Max validation retries">
          <TextInput
            type="number"
            min={0}
            value={draft.max_validation_retries ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                max_validation_retries:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field
          label="Surface kind"
          hint="e.g. conversation:42 to post completion as a chat message"
        >
          <TextInput
            value={draft.surface_kind ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, surface_kind: e.target.value }))}
            className="font-mono"
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
            <PrimaryButton type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
