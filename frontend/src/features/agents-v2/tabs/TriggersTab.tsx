import { useMemo, useState } from 'react';
import type { Agent } from '../types';
import { patchAgent } from '../api';
import { Field, TextInput, SelectInput } from '../../connectors/components/Field';
import { Modal } from '../../connectors/components/Modal';
import {
  PrimaryButton,
  SecondaryButton,
  GhostButton,
} from '../../connectors/components/Toolbar';
import { TriggerCard } from '../components/TriggerCard';
import { CronInput } from '../components/CronInput';
import { TablePicker } from '../components/TablePicker';
import { AgentPicker } from '../components/AgentPicker';

const TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
];

const API_BASE = '';

function diff(a: Agent, b: Agent): Partial<Agent> {
  const out: Partial<Agent> = {};
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === 'Id') continue;
    if (JSON.stringify((a as Record<string, unknown>)[k]) !== JSON.stringify((b as Record<string, unknown>)[k])) {
      (out as Record<string, unknown>)[k] = (b as Record<string, unknown>)[k];
    }
  }
  return out;
}

function randomHex(n: number): string {
  const arr = new Uint8Array(Math.ceil(n / 2));
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, n);
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export function TriggersTab({
  agent,
  onChanged,
}: {
  agent: Agent;
  onChanged: (next: Agent) => void;
}) {
  const [draft, setDraft] = useState<Agent>(agent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurl, setShowCurl] = useState(false);
  const [tableTestMsg, setTableTestMsg] = useState<string | null>(null);

  // Reset draft if parent agent changed
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

  // Per-trigger enable flags: derived from the underlying field being set.
  const cronOn = !!draft.cron_expression;
  const intervalOn = (draft.trigger_interval_minutes ?? 0) > 0;
  const emailOn = !!draft.trigger_email_address || draft.trigger_email_address === '';
  const apiOn = !!draft.trigger_api_slug;
  const webhookOn = !!draft.trigger_webhook_secret;
  const supervisorOn = !!draft.trigger_supervisor;
  const tableWatchOn = !!draft.trigger_table_watch_json;
  const completionOn = (draft.trigger_on_completion_of?.length ?? 0) > 0;

  const summaryChips: string[] = [];
  if (cronOn) summaryChips.push(`cron at ${draft.cron_expression}`);
  if (intervalOn)
    summaryChips.push(`every ${draft.trigger_interval_minutes} min`);
  if (draft.trigger_email_address)
    summaryChips.push(`email arrives at ${draft.trigger_email_address}`);
  if (apiOn) summaryChips.push(`api /run/${draft.trigger_api_slug}`);
  if (webhookOn) summaryChips.push('webhook posted');
  if (supervisorOn) summaryChips.push('supervisor delegates');
  if (tableWatchOn) {
    const w = draft.trigger_table_watch_json;
    summaryChips.push(`table ${w?.table ?? '?'} on ${w?.on ?? 'insert'}`);
  }
  if (completionOn)
    summaryChips.push(
      `on completion of ${draft.trigger_on_completion_of?.length} agent(s)`,
    );

  const slug = draft.trigger_api_slug ?? '';
  const apiUrl = `${API_BASE}/api/agents/${slug}/run`;
  const webhookUrl = `${API_BASE}/api/agents/${draft.Id}/webhook`;

  return (
    <div className="p-6 space-y-4 pb-32">
      <TriggerCard
        title="Cron"
        description="Run on a schedule."
        enabled={cronOn}
        onToggle={(on) =>
          setDraft((d) => ({
            ...d,
            cron_expression: on ? d.cron_expression || '0 9 * * 1-5' : null,
          }))
        }
      >
        <Field label="Cron expression">
          <CronInput
            value={draft.cron_expression}
            onChange={(v) => setDraft((d) => ({ ...d, cron_expression: v }))}
          />
        </Field>
        <Field label="Timezone">
          <SelectInput
            value={draft.trigger_timezone ?? 'Australia/Sydney'}
            onChange={(e) =>
              setDraft((d) => ({ ...d, trigger_timezone: e.target.value }))
            }
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Run window" hint="Free-text window of allowed run hours">
          <TextInput
            value={draft.run_window ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, run_window: e.target.value }))}
            placeholder="09:00-17:00"
            className="font-mono"
          />
        </Field>
        <Field label="Pause until">
          <TextInput
            type="datetime-local"
            value={draft.pause_until ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, pause_until: e.target.value || null }))
            }
          />
        </Field>
      </TriggerCard>

      <TriggerCard
        title="Interval"
        description="Run on a fixed interval."
        enabled={intervalOn}
        onToggle={(on) =>
          setDraft((d) => ({
            ...d,
            trigger_interval_minutes: on ? d.trigger_interval_minutes || 15 : null,
          }))
        }
      >
        <Field label="Interval (minutes)">
          <TextInput
            type="number"
            min={1}
            value={draft.trigger_interval_minutes ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                trigger_interval_minutes:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        </Field>
      </TriggerCard>

      <TriggerCard
        title="Email"
        description="Send email to this address to create an assignment."
        enabled={emailOn}
        onToggle={(on) =>
          setDraft((d) => ({
            ...d,
            trigger_email_address: on ? d.trigger_email_address ?? '' : null,
          }))
        }
      >
        <Field label="Trigger email address">
          {draft.trigger_email_address ? (
            <div className="flex items-center gap-2">
              <TextInput value={draft.trigger_email_address} readOnly className="font-mono" />
              <SecondaryButton
                type="button"
                onClick={() => copy(draft.trigger_email_address ?? '')}
              >
                Copy
              </SecondaryButton>
            </div>
          ) : (
            <div className="text-xs text-muted">
              The trigger address will be assigned automatically once saved.
            </div>
          )}
        </Field>
      </TriggerCard>

      <TriggerCard
        title="API endpoint"
        description="Call a slug-named endpoint to enqueue a run."
        enabled={apiOn}
        onToggle={(on) =>
          setDraft((d) => ({
            ...d,
            trigger_api_slug: on ? d.trigger_api_slug || '' : null,
          }))
        }
      >
        <Field
          label="Slug"
          hint="lowercase letters, digits, hyphens only"
          error={
            draft.trigger_api_slug && !/^[a-z0-9-]+$/.test(draft.trigger_api_slug)
              ? 'Invalid slug'
              : undefined
          }
        >
          <TextInput
            value={draft.trigger_api_slug ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                trigger_api_slug: e.target.value.toLowerCase(),
              }))
            }
            placeholder="my-agent-slug"
            className="font-mono"
          />
        </Field>
        {slug && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-bg border border-border px-2 py-1 truncate">
                POST {apiUrl}
              </code>
              <SecondaryButton type="button" onClick={() => copy(`POST ${apiUrl}`)}>
                Copy
              </SecondaryButton>
              <SecondaryButton type="button" onClick={() => setShowCurl(true)}>
                View example curl
              </SecondaryButton>
            </div>
          </div>
        )}
      </TriggerCard>

      <TriggerCard
        title="Webhook"
        description="POST signed payloads to invoke this agent."
        enabled={webhookOn}
        onToggle={(on) =>
          setDraft((d) => ({
            ...d,
            trigger_webhook_secret: on ? d.trigger_webhook_secret || randomHex(32) : null,
          }))
        }
      >
        <Field label="Secret">
          <div className="flex items-center gap-2">
            <TextInput
              type="password"
              value={draft.trigger_webhook_secret ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, trigger_webhook_secret: e.target.value }))
              }
              className="font-mono"
            />
            <SecondaryButton
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, trigger_webhook_secret: randomHex(32) }))
              }
            >
              Rotate
            </SecondaryButton>
          </div>
        </Field>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-xs bg-bg border border-border px-2 py-1 truncate">
            POST {webhookUrl}
          </code>
          <SecondaryButton type="button" onClick={() => copy(`POST ${webhookUrl}`)}>
            Copy
          </SecondaryButton>
        </div>
        <p className="text-[11px] text-muted">
          Sign requests with{' '}
          <code className="font-mono">
            X-Hub-Signature-256: hmac-sha256(body, secret)
          </code>
          .
        </p>
      </TriggerCard>

      <TriggerCard
        title="Supervisor handoff"
        description="When on, parent supervisor agents may delegate to this agent."
        enabled={supervisorOn}
        onToggle={(on) => setDraft((d) => ({ ...d, trigger_supervisor: on }))}
      />

      <TriggerCard
        title="Table watch"
        description="Trigger when rows match a filter on insert/update."
        enabled={tableWatchOn}
        onToggle={(on) =>
          setDraft((d) => ({
            ...d,
            trigger_table_watch_json: on
              ? d.trigger_table_watch_json ?? { table: '', filter: '', on: 'insert' }
              : null,
          }))
        }
      >
        <Field label="Table">
          <TablePicker
            value={draft.trigger_table_watch_json?.table ?? null}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                trigger_table_watch_json: {
                  ...(d.trigger_table_watch_json ?? {}),
                  table: v ?? '',
                },
              }))
            }
          />
        </Field>
        <Field label="Filter" hint="NocoDB where syntax">
          <div className="flex items-center gap-2">
            <TextInput
              value={draft.trigger_table_watch_json?.filter ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  trigger_table_watch_json: {
                    ...(d.trigger_table_watch_json ?? {}),
                    filter: e.target.value,
                  },
                }))
              }
              className="font-mono"
            />
            <SecondaryButton
              type="button"
              onClick={() => setTableTestMsg('Filter test not implemented yet')}
            >
              Test filter
            </SecondaryButton>
          </div>
        </Field>
        {tableTestMsg && <div className="text-xs text-muted">{tableTestMsg}</div>}
        <Field label="On">
          <div className="flex gap-3 text-xs">
            {(['insert', 'update'] as const).map((on) => (
              <label key={on} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="table_watch_on"
                  checked={(draft.trigger_table_watch_json?.on ?? 'insert') === on}
                  onChange={() =>
                    setDraft((d) => ({
                      ...d,
                      trigger_table_watch_json: {
                        ...(d.trigger_table_watch_json ?? {}),
                        on,
                      },
                    }))
                  }
                />
                <span className="font-mono">{on}</span>
              </label>
            ))}
          </div>
        </Field>
      </TriggerCard>

      <TriggerCard
        title="On completion of"
        description="Fires whenever any of these complete an assignment."
        enabled={completionOn}
        onToggle={(on) =>
          setDraft((d) => ({
            ...d,
            trigger_on_completion_of: on ? d.trigger_on_completion_of ?? [] : null,
          }))
        }
      >
        <AgentPicker
          multi
          excludeId={draft.Id}
          value={draft.trigger_on_completion_of ?? []}
          onChange={(v) => setDraft((d) => ({ ...d, trigger_on_completion_of: v }))}
        />
      </TriggerCard>

      <section className="border border-border bg-panel p-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
          This agent will run when:
        </div>
        {summaryChips.length === 0 ? (
          <div className="text-xs text-muted">
            No triggers active — this agent runs only when invoked manually.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {summaryChips.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center border border-border bg-bg px-2 py-0.5 text-[11px] font-mono"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={showCurl}
        onClose={() => setShowCurl(false)}
        title="Example curl"
        size="md"
      >
        <pre className="font-mono text-xs whitespace-pre-wrap">
{`curl -X POST '${apiUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer <YOUR_TOKEN>' \\
  -d '{"task": "do something"}'`}
        </pre>
      </Modal>

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
