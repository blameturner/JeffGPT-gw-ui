import { useState } from 'react';
import { Modal } from '../../connectors/components/Modal';
import { Field, TextArea, TextInput } from '../../connectors/components/Field';
import { GhostButton, PrimaryButton } from '../../connectors/components/Toolbar';
import { runAgentNow } from '../api';
import type { Agent } from '../types';

export function RunNowDialog({
  agent,
  onClose,
  onQueued,
}: {
  agent: Agent;
  onClose: () => void;
  onQueued: (assignmentId: number) => void;
}) {
  const [task, setTask] = useState<string>(agent.brief ?? '');
  const [priority, setPriority] = useState<number>(3);
  const [dedupKey, setDedupKey] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        task: task.trim() || undefined,
        priority,
        dedup_key: dedupKey.trim() || undefined,
      };
      const res = await runAgentNow(agent.Id, body);
      setQueuedId(res.assignment_id);
      onQueued(res.assignment_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue run.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Run agent now"
      footer={
        <div className="flex items-center justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>
            Close
          </GhostButton>
          <PrimaryButton type="submit" form="run-now-form" disabled={busy}>
            {busy ? 'Queuing…' : 'Queue run'}
          </PrimaryButton>
        </div>
      }
    >
      <form id="run-now-form" onSubmit={submit} className="space-y-4">
        <Field label="Task">
          <TextArea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={6}
            placeholder="What should the agent do?"
          />
        </Field>
        <Field label={`Priority — ${priority}`} hint="1 = lowest, 5 = highest">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full accent-fg"
          />
        </Field>
        <Field label="Dedup key" hint="Optional. Suppresses duplicate enqueues with the same key.">
          <TextInput
            value={dedupKey}
            onChange={(e) => setDedupKey(e.target.value)}
            placeholder="e.g. nightly-2026-04-29"
          />
        </Field>
        {error && (
          <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs">
            {error}
          </div>
        )}
        {queuedId != null && (
          <div className="border border-emerald-300 bg-emerald-50 text-emerald-900 px-3 py-2 text-xs font-mono">
            Queued #{queuedId}
          </div>
        )}
      </form>
    </Modal>
  );
}
