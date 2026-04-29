import { useState } from 'react';
import type { Agent, EditMode, InboxKind, ReplyMode } from '../types';
import { Field, TextInput } from '../../connectors/components/Field';
import { Modal } from '../../connectors/components/Modal';
import { SecondaryButton, GhostButton } from '../../connectors/components/Toolbar';
import { TablePicker } from './TablePicker';
import { ColumnPicker } from './ColumnPicker';
import { AgentPicker } from './AgentPicker';

export function TypeConfigPanel({
  draft,
  setDraft,
}: {
  draft: Agent;
  setDraft: (mut: (d: Agent) => Agent) => void;
}) {
  switch (draft.type) {
    case 'document':
      return <DocumentPanel draft={draft} setDraft={setDraft} />;
    case 'queue':
      return <QueuePanel draft={draft} setDraft={setDraft} />;
    case 'producer':
      return <ProducerPanel draft={draft} setDraft={setDraft} />;
    case 'responder':
      return <ResponderPanel draft={draft} setDraft={setDraft} />;
    case 'supervisor':
      return <SupervisorPanel draft={draft} setDraft={setDraft} />;
    default:
      return (
        <div className="text-xs text-muted">
          No type-specific configuration for type &quot;{String(draft.type)}&quot;.
        </div>
      );
  }
}

function DocumentPanel({
  draft,
  setDraft,
}: {
  draft: Agent;
  setDraft: (mut: (d: Agent) => Agent) => void;
}) {
  const [pickRowOpen, setPickRowOpen] = useState(false);
  return (
    <div className="space-y-3">
      <Field label="Target table">
        <TablePicker
          value={draft.target_table ?? null}
          onChange={(v) =>
            setDraft((d) => ({ ...d, target_table: v, target_column: null }))
          }
        />
      </Field>
      <Field label="Target row id">
        <div className="flex items-center gap-2">
          <TextInput
            type="number"
            value={draft.target_row_id ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                target_row_id: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
          <SecondaryButton type="button" onClick={() => setPickRowOpen(true)}>
            Pick row
          </SecondaryButton>
        </div>
      </Field>
      <Field label="Target column" hint="Long-text columns only">
        <ColumnPicker
          tableName={draft.target_table ?? null}
          filter="long_text"
          value={draft.target_column ?? null}
          onChange={(v) => setDraft((d) => ({ ...d, target_column: v }))}
        />
      </Field>
      <Field label="Edit mode">
        <div className="flex flex-col gap-1 text-xs">
          {(['replace', 'append', 'patch_section'] as EditMode[]).map((m) => (
            <label key={m} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="edit_mode"
                checked={(draft.edit_mode ?? 'replace') === m}
                onChange={() => setDraft((d) => ({ ...d, edit_mode: m }))}
              />
              <span className="font-mono">{m}</span>
              <span className="text-muted">
                {m === 'replace' && '— overwrite the column entirely'}
                {m === 'append' && '— append to existing content'}
                {m === 'patch_section' && '— update a labelled section in place'}
              </span>
            </label>
          ))}
        </div>
      </Field>
      <details className="border border-border bg-bg p-2">
        <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-muted">
          Preview current document
        </summary>
        <div className="font-mono text-xs text-muted mt-2">
          {draft.target_table || '<table>'} / {draft.target_row_id ?? '<row>'} /{' '}
          {draft.target_column || '<column>'}
        </div>
      </details>
      <Modal
        open={pickRowOpen}
        onClose={() => setPickRowOpen(false)}
        title="Pick row"
        size="md"
      >
        <p className="text-sm text-muted">
          Row picker not yet implemented — paste the row ID into the field above.
        </p>
      </Modal>
    </div>
  );
}

function QueuePanel({
  draft,
  setDraft,
}: {
  draft: Agent;
  setDraft: (mut: (d: Agent) => Agent) => void;
}) {
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Field label="Target table">
        <TablePicker
          value={draft.target_table ?? null}
          onChange={(v) => setDraft((d) => ({ ...d, target_table: v }))}
        />
      </Field>
      <Field label="Filter" hint="NocoDB where syntax">
        <div className="flex items-center gap-2">
          <TextInput
            value={draft.filter ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, filter: e.target.value }))}
            className="font-mono"
          />
          <SecondaryButton
            type="button"
            onClick={() => setFilterMsg('Filter test not implemented yet')}
          >
            Test filter
          </SecondaryButton>
        </div>
      </Field>
      {filterMsg && <div className="text-xs text-muted">{filterMsg}</div>}
      <Field label="Output column">
        <ColumnPicker
          tableName={draft.target_table ?? null}
          value={draft.output_column ?? null}
          onChange={(v) => setDraft((d) => ({ ...d, output_column: v }))}
        />
      </Field>
      <Field label="Done column">
        <ColumnPicker
          tableName={draft.target_table ?? null}
          value={draft.done_column ?? null}
          onChange={(v) => setDraft((d) => ({ ...d, done_column: v }))}
        />
      </Field>
      <Field label="Batch size">
        <TextInput
          type="number"
          min={1}
          value={draft.batch_size ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              batch_size: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
        />
      </Field>
    </div>
  );
}

function ProducerPanel({
  draft,
  setDraft,
}: {
  draft: Agent;
  setDraft: (mut: (d: Agent) => Agent) => void;
}) {
  const rows = draft.column_map ?? [];
  function update(ix: number, patch: Partial<{ column: string; value: string }>) {
    setDraft((d) => {
      const next = [...(d.column_map ?? [])];
      next[ix] = { ...next[ix], ...patch };
      return { ...d, column_map: next };
    });
  }
  function add() {
    setDraft((d) => ({
      ...d,
      column_map: [...(d.column_map ?? []), { column: '', value: '' }],
    }));
  }
  function remove(ix: number) {
    setDraft((d) => ({
      ...d,
      column_map: (d.column_map ?? []).filter((_, i) => i !== ix),
    }));
  }
  return (
    <div className="space-y-3">
      <Field label="Target table">
        <TablePicker
          value={draft.target_table ?? null}
          onChange={(v) => setDraft((d) => ({ ...d, target_table: v }))}
        />
      </Field>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted font-sans">
            Column map
          </span>
          <SecondaryButton type="button" onClick={add}>
            Add row
          </SecondaryButton>
        </div>
        <p className="text-[11px] text-muted mb-2">
          Use <span className="font-mono">&lt;llm.body&gt;</span> to map an LLM-emitted JSON
          field to a column.
        </p>
        {rows.length === 0 && (
          <div className="text-xs text-muted">No mappings yet.</div>
        )}
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end"
            >
              <ColumnPicker
                tableName={draft.target_table ?? null}
                value={r.column}
                onChange={(v) => update(i, { column: v ?? '' })}
              />
              <TextInput
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="<llm.body.field>"
                className="font-mono"
              />
              <GhostButton type="button" onClick={() => remove(i)}>
                Remove
              </GhostButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResponderPanel({
  draft,
  setDraft,
}: {
  draft: Agent;
  setDraft: (mut: (d: Agent) => Agent) => void;
}) {
  const noLog = !draft.log_table;
  return (
    <div className="space-y-3">
      <Field label="Inbox kind">
        <div className="flex flex-wrap gap-3 text-xs">
          {(['email', 'api', 'conversation'] as InboxKind[]).map((k) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="inbox_kind"
                checked={draft.inbox_kind === k}
                onChange={() => setDraft((d) => ({ ...d, inbox_kind: k }))}
              />
              <span className="font-mono">{k}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Reply mode">
        <div className="flex flex-wrap gap-3 text-xs">
          {(['auto', 'approval', 'none'] as ReplyMode[]).map((k) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="reply_mode"
                checked={draft.reply_mode === k}
                onChange={() => setDraft((d) => ({ ...d, reply_mode: k }))}
              />
              <span className="font-mono">{k}</span>
            </label>
          ))}
        </div>
      </Field>
      {draft.reply_mode === 'auto' && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 text-xs p-3">
          <strong>Auto-reply enabled:</strong> this agent will send replies without human
          review. Make sure tools, persona, and approval rules are tight.
        </div>
      )}
      <Field label="Log table">
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={noLog}
              onChange={(e) =>
                setDraft((d) => ({ ...d, log_table: e.target.checked ? null : '' }))
              }
            />
            <span>None (don&apos;t log replies)</span>
          </label>
          {!noLog && (
            <TablePicker
              value={draft.log_table ?? null}
              onChange={(v) => setDraft((d) => ({ ...d, log_table: v }))}
            />
          )}
        </div>
      </Field>
    </div>
  );
}

function SupervisorPanel({
  draft,
  setDraft,
}: {
  draft: Agent;
  setDraft: (mut: (d: Agent) => Agent) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Team agents">
        <AgentPicker
          multi
          excludeId={draft.Id}
          value={draft.team_agent_ids ?? []}
          onChange={(v) => setDraft((d) => ({ ...d, team_agent_ids: v }))}
        />
      </Field>
      <Field
        label="Escalate to user id"
        hint="User picker not yet implemented; paste user id"
      >
        <TextInput
          value={
            draft.escalate_to_user_id == null ? '' : String(draft.escalate_to_user_id)
          }
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              escalate_to_user_id: e.target.value === '' ? null : e.target.value,
            }))
          }
        />
      </Field>
    </div>
  );
}
