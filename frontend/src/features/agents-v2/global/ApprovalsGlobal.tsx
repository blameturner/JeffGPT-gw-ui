import { useEffect, useRef, useState } from 'react';
import { approveApproval, listApprovals, rejectApproval } from '../api';
import type { AgentApproval } from '../types';
import { ApprovalCard } from '../components/ApprovalCard';
import { Modal } from '../../connectors/components/Modal';
import { Field, TextInput } from '../../connectors/components/Field';
import { PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';
import { EmptyState } from '../../connectors/components/EmptyState';

type DialogKind = 'approve' | 'reject';

export function ApprovalsGlobal() {
  const [items, setItems] = useState<AgentApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [dialog, setDialog] = useState<{ kind: DialogKind; approval: AgentApproval } | null>(null);
  const [note, setNote] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // TODO: subscribe to approvals channel for live updates
      const res = await listApprovals();
      const pending = res.approvals.filter((a) => a.status === 'pending');
      setItems(pending);
      setFocusedIdx((idx) => Math.min(idx, Math.max(0, pending.length - 1)));
    } catch (e) {
      setError((e as Error).message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Keyboard navigation when no input focused.
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (el as HTMLElement).isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if (dialog) return;
      if (isTyping()) return;
      if (items.length === 0) return;
      if (e.key === 'j') {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'k') {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'a') {
        e.preventDefault();
        const a = items[focusedIdx];
        if (a) {
          setNote('');
          setDialog({ kind: 'approve', approval: a });
        }
      } else if (e.key === 'r') {
        e.preventDefault();
        const a = items[focusedIdx];
        if (a) {
          setNote('');
          setDialog({ kind: 'reject', approval: a });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, focusedIdx, dialog]);

  // Scroll focused card into view.
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-approval-id="${items[focusedIdx]?.Id}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx, items]);

  async function submit() {
    if (!dialog) return;
    try {
      if (dialog.kind === 'approve') await approveApproval(dialog.approval.Id, note || undefined);
      else await rejectApproval(dialog.approval.Id, note || undefined);
      setDialog(null);
      setNote('');
      load();
    } catch (e) {
      setError((e as Error).message || 'Action failed');
    }
  }

  return (
    <div ref={containerRef} className="p-6 space-y-3">
      {error && (
        <div className="border border-red-600/40 bg-panel px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <SecondaryButton onClick={load}>Retry</SecondaryButton>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border bg-panel">
              <div className="h-10 animate-pulse" />
              <div className="h-32 animate-pulse" />
              <div className="h-10 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <EmptyState
          title="Nothing waiting on you"
          body="Approvals queued by your agents will show up here."
        />
      )}

      {items.length > 0 && (
        <>
          <div className="text-xs text-muted font-mono">
            {items.length} pending · use j/k to navigate, a to approve, r to reject
          </div>
          <div className="space-y-3">
            {items.map((a, i) => (
              <ApprovalCard
                key={a.Id}
                approval={a}
                focused={i === focusedIdx}
                onFocus={() => setFocusedIdx(i)}
                onApprove={() => {
                  setNote('');
                  setFocusedIdx(i);
                  setDialog({ kind: 'approve', approval: a });
                }}
                onReject={() => {
                  setNote('');
                  setFocusedIdx(i);
                  setDialog({ kind: 'reject', approval: a });
                }}
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        size="sm"
        title={dialog?.kind === 'approve' ? 'Approve & run' : 'Reject'}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setDialog(null)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={submit}>
              {dialog?.kind === 'approve' ? 'Approve' : 'Reject'}
            </PrimaryButton>
          </div>
        }
      >
        <Field label="Note (optional)">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an optional note"
            autoFocus
          />
        </Field>
      </Modal>
    </div>
  );
}
