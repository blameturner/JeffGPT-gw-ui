import { useMemo, useState } from 'react';
import type { Agent, OnErrorAction } from '../types';
import { deleteAgent, patchAgent, resetCircuit, resetCounters } from '../api';
import { Field, TextInput, Toggle, SelectInput } from '../../connectors/components/Field';
import {
  PrimaryButton,
  SecondaryButton,
  GhostButton,
} from '../../connectors/components/Toolbar';
import { DangerZone } from '../../connectors/components/DangerZone';
import { AgentPicker } from '../components/AgentPicker';

const APPROVAL_FIXED = [
  'send_email',
  'http_post',
  'http_put',
  'http_delete',
  'sql_write',
  'nocodb_insert',
  'nocodb_update',
  'nocodb_delete',
  'custom',
];

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

function NotifyEditor({
  rows,
  onChange,
}: {
  rows: Array<{ channel: string; target: string }>;
  onChange: (next: Array<{ channel: string; target: string }>) => void;
}) {
  function update(ix: number, patch: Partial<{ channel: string; target: string }>) {
    const next = [...rows];
    next[ix] = { ...next[ix], ...patch };
    onChange(next);
  }
  return (
    <div className="space-y-2">
      {rows.length === 0 && <div className="text-xs text-muted">No notifications.</div>}
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)_auto] gap-2 items-end"
        >
          <SelectInput
            value={r.channel}
            onChange={(e) => update(i, { channel: e.target.value })}
          >
            <option value="email">email</option>
            <option value="slack">slack</option>
            <option value="conversation">conversation</option>
          </SelectInput>
          <TextInput
            value={r.target}
            onChange={(e) => update(i, { target: e.target.value })}
            placeholder="user@example.com / #channel / 42"
            className="font-mono"
          />
          <GhostButton
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            Remove
          </GhostButton>
        </div>
      ))}
      <SecondaryButton
        type="button"
        onClick={() => onChange([...rows, { channel: 'email', target: '' }])}
      >
        Add row
      </SecondaryButton>
    </div>
  );
}

export function SafetyTab({
  agent,
  onChanged,
  onDeleted,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
  onDeleted?: () => void;
}) {
  const [draft, setDraft] = useState<Agent>(agent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [customApproval, setCustomApproval] = useState('');

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

  async function doResetCounters() {
    setBusyAction('counters');
    try {
      const res = await resetCounters(agent.Id);
      onChanged(res);
      setDraft(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAction(null);
    }
  }
  async function doResetCircuit() {
    setBusyAction('circuit');
    try {
      const res = await resetCircuit(agent.Id);
      onChanged(res);
      setDraft(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  const requiresApproval = draft.requires_approval_for ?? [];
  const fixedSelected = requiresApproval.filter((x) => APPROVAL_FIXED.includes(x));
  const customSelected = requiresApproval.filter((x) => !APPROVAL_FIXED.includes(x));
  const showCustomInput = fixedSelected.includes('custom');

  function toggleApproval(name: string) {
    if (requiresApproval.includes(name)) {
      setDraft((d) => ({
        ...d,
        requires_approval_for: requiresApproval.filter((x) => x !== name),
      }));
    } else {
      setDraft((d) => ({
        ...d,
        requires_approval_for: [...requiresApproval, name],
      }));
    }
  }

  function addCustomApproval() {
    const name = customApproval.trim();
    if (!name || requiresApproval.includes(name)) return;
    setDraft((d) => ({
      ...d,
      requires_approval_for: [...requiresApproval, name],
    }));
    setCustomApproval('');
  }

  const route = draft.approval_route ?? { kind: 'user' as const };

  return (
    <div className="p-6 space-y-4 pb-32">
      <Card title="Per-run budgets">
        <Field label="Max iterations">
          <TextInput
            type="number"
            min={1}
            value={draft.max_iterations ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                max_iterations: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="Max runtime (seconds)">
          <TextInput
            type="number"
            min={1}
            value={draft.max_runtime_seconds ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                max_runtime_seconds:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="Max tokens per run">
          <TextInput
            type="number"
            min={1}
            value={draft.max_tokens_per_run ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                max_tokens_per_run:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
      </Card>

      <Card title="Per-day caps">
        <Field label="Max runs per day">
          <div className="flex items-center gap-2">
            <TextInput
              type="number"
              min={0}
              value={draft.max_runs_per_day ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  max_runs_per_day:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <span className="text-xs text-muted font-mono">
              today: {agent.runs_today ?? 0}
            </span>
          </div>
        </Field>
        <Field label="Max tokens per day">
          <div className="flex items-center gap-2">
            <TextInput
              type="number"
              min={0}
              value={draft.max_tokens_per_day ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  max_tokens_per_day:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <span className="text-xs text-muted font-mono">
              today: {agent.tokens_today ?? 0}
            </span>
          </div>
        </Field>
        <Field label="Max cost USD per day">
          <div className="flex items-center gap-2">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={draft.max_cost_usd_per_day ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  max_cost_usd_per_day:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <span className="text-xs text-muted font-mono">
              today: ${agent.cost_usd_today ?? 0}
            </span>
          </div>
        </Field>
        <SecondaryButton
          type="button"
          onClick={doResetCounters}
          disabled={busyAction === 'counters'}
        >
          {busyAction === 'counters' ? 'Resetting…' : 'Reset daily counters now'}
        </SecondaryButton>
      </Card>

      <Card title="Concurrency">
        <Field label="Max concurrent runs">
          <TextInput
            type="number"
            min={1}
            value={draft.max_concurrent_runs ?? 1}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                max_concurrent_runs:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="Heartbeat TTL (seconds)">
          <TextInput
            type="number"
            min={1}
            value={draft.heartbeat_ttl_seconds ?? 60}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                heartbeat_ttl_seconds:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
      </Card>

      <Card title="Approvals">
        <Field label="Requires approval for">
          <div className="flex flex-wrap gap-1">
            {APPROVAL_FIXED.map((name) => {
              const on = fixedSelected.includes(name);
              return (
                <button
                  type="button"
                  key={name}
                  onClick={() => toggleApproval(name)}
                  className={[
                    'inline-flex items-center px-2 py-0.5 text-[11px] font-mono border',
                    on
                      ? 'bg-fg text-bg border-fg'
                      : 'bg-bg text-fg border-border hover:border-fg',
                  ].join(' ')}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {customSelected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {customSelected.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1 border border-border bg-panelHi px-2 py-0.5 text-[11px] font-mono"
                >
                  {n}
                  <button
                    type="button"
                    onClick={() => toggleApproval(n)}
                    className="text-muted hover:text-fg"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {showCustomInput && (
            <div className="mt-2 flex items-center gap-2">
              <TextInput
                value={customApproval}
                onChange={(e) => setCustomApproval(e.target.value)}
                placeholder="custom_action_name"
                className="font-mono"
              />
              <SecondaryButton type="button" onClick={addCustomApproval}>
                Add
              </SecondaryButton>
            </div>
          )}
        </Field>
        <Field label="Approval route">
          <div className="flex gap-3 text-xs mb-2">
            {(['user', 'agent'] as const).map((k) => (
              <label key={k} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="approval_route"
                  checked={route.kind === k}
                  onChange={() =>
                    setDraft((d) => ({
                      ...d,
                      approval_route: { kind: k, target: undefined },
                    }))
                  }
                />
                <span className="font-mono">{k}</span>
              </label>
            ))}
          </div>
          {route.kind === 'agent' ? (
            <AgentPicker
              excludeId={draft.Id}
              value={typeof route.target === 'number' ? route.target : null}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  approval_route: { kind: 'agent', target: v ?? undefined },
                }))
              }
            />
          ) : (
            <TextInput
              value={route.target == null ? '' : String(route.target)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  approval_route: {
                    kind: 'user',
                    target: e.target.value === '' ? undefined : e.target.value,
                  },
                }))
              }
              placeholder="user id"
            />
          )}
        </Field>
      </Card>

      <Card title="Modes">
        <Field label="Dry run" hint="Plan and log but don't write artifacts.">
          <Toggle
            checked={!!draft.dry_run}
            onChange={(v) => setDraft((d) => ({ ...d, dry_run: v }))}
          />
        </Field>
        <Field label="Test mode" hint="Use stub tools and avoid external side-effects.">
          <Toggle
            checked={!!draft.test_mode}
            onChange={(v) => setDraft((d) => ({ ...d, test_mode: v }))}
          />
        </Field>
      </Card>

      <Card title="Failure handling">
        <Field label="On error action">
          <div className="flex flex-wrap gap-3 text-xs">
            {(['retry', 'escalate', 'pause', 'fallback'] as OnErrorAction[]).map((a) => (
              <label key={a} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="on_error_action"
                  checked={draft.on_error_action === a}
                  onChange={() => setDraft((d) => ({ ...d, on_error_action: a }))}
                />
                <span className="font-mono">{a}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Circuit breaker threshold">
          <div className="flex items-center gap-2">
            <TextInput
              type="number"
              min={1}
              value={draft.circuit_breaker_threshold ?? 5}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  circuit_breaker_threshold:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <span className="text-xs font-mono text-muted">
              consecutive_failures = {agent.consecutive_failures ?? 0}
            </span>
            <SecondaryButton
              type="button"
              onClick={doResetCircuit}
              disabled={busyAction === 'circuit'}
            >
              {busyAction === 'circuit' ? 'Resetting…' : 'Reset circuit'}
            </SecondaryButton>
          </div>
        </Field>
        <Field label="Fallback agent">
          <AgentPicker
            excludeId={draft.Id}
            value={draft.fallback_agent_id ?? null}
            onChange={(v) => setDraft((d) => ({ ...d, fallback_agent_id: v }))}
          />
        </Field>
      </Card>

      <Card title="Caching">
        <Field label="Memoize TTL (seconds)">
          <TextInput
            type="number"
            min={0}
            value={draft.memoize_ttl_seconds ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                memoize_ttl_seconds:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="Tool cache TTL (seconds)">
          <TextInput
            type="number"
            min={0}
            value={draft.tool_cache_ttl_seconds ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                tool_cache_ttl_seconds:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
      </Card>

      <Card
        title="Hooks"
        helper="Runs in the runtime process; ensure module is importable."
      >
        <Field label="Pre-run hook">
          <TextInput
            value={draft.pre_run_hook ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, pre_run_hook: e.target.value }))}
            placeholder="my_pkg.module:pre_run"
            className="font-mono"
          />
        </Field>
        <Field label="Post-run hook">
          <TextInput
            value={draft.post_run_hook ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, post_run_hook: e.target.value }))}
            placeholder="my_pkg.module:post_run"
            className="font-mono"
          />
        </Field>
      </Card>

      <Card title="Notifications">
        <Field label="Notify on complete">
          <NotifyEditor
            rows={draft.notify_on_complete_json ?? []}
            onChange={(rows) =>
              setDraft((d) => ({ ...d, notify_on_complete_json: rows }))
            }
          />
        </Field>
        <Field label="Notify on error">
          <NotifyEditor
            rows={draft.notify_on_error_json ?? []}
            onChange={(rows) =>
              setDraft((d) => ({ ...d, notify_on_error_json: rows }))
            }
          />
        </Field>
      </Card>

      <DangerZone
        resourceLabel="agent"
        confirmName={agent.name}
        onDelete={async () => {
          await deleteAgent(agent.Id);
          onDeleted?.();
        }}
      />

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
