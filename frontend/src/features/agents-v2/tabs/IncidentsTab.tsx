import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../connectors/components/Modal';
import { Field, TextArea } from '../../connectors/components/Field';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../connectors/components/Toolbar';
import { listIncidents, resolveIncident } from '../api';
import type { Agent, AgentIncident } from '../types';

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function relative(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return `${days} d ago`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function KindChip({ kind }: { kind: string }) {
  return (
    <span className="inline-block text-[10px] uppercase tracking-[0.14em] font-mono border border-border px-1.5 py-[1px] text-muted">
      {kind}
    </span>
  );
}

export function IncidentsTab({ agent }: { agent: Agent }) {
  const [items, setItems] = useState<AgentIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentIncident | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listIncidents({ agent_id: agent.Id });
      setItems(r.incidents);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load incidents.');
    } finally {
      setLoading(false);
    }
  }, [agent.Id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCount = items.filter((it) => !it.resolved).length;

  async function submitResolve() {
    if (!selected) return;
    setBusy(true);
    try {
      await resolveIncident(selected.Id, note.trim());
      setSelected(null);
      setNote('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve incident.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      {openCount > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
          {openCount} open incident{openCount === 1 ? '' : 's'}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg tracking-tightest">Incidents</h2>
        <SecondaryButton onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </SecondaryButton>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-900 px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {!loading && items.length === 0 ? (
        <div className="text-xs text-muted">No incidents recorded.</div>
      ) : (
        <ul className="border border-border divide-y divide-border bg-panel">
          {items.map((it) => (
            <li key={it.Id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(it);
                  setNote('');
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-panelHi"
              >
                <KindChip kind={it.kind} />
                <span className="flex-1 truncate text-sm font-sans">{truncate(it.reason, 140)}</span>
                <span className="text-[11px] font-mono text-muted shrink-0">
                  {formatTime(it.created_at)}
                  <span className="ml-1">({relative(it.created_at)})</span>
                </span>
                <span
                  className={`text-[10px] uppercase tracking-[0.14em] px-1.5 py-[1px] border ${
                    it.resolved
                      ? 'text-emerald-700 border-emerald-300'
                      : 'text-amber-700 border-amber-300'
                  }`}
                >
                  {it.resolved ? 'resolved' : 'open'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          size="md"
          title={
            <span className="flex items-center gap-2">
              <KindChip kind={selected.kind} />
              <span>Incident #{selected.Id}</span>
            </span>
          }
          footer={
            <div className="flex items-center justify-end gap-2">
              <GhostButton type="button" onClick={() => setSelected(null)}>
                Close
              </GhostButton>
              {!selected.resolved && (
                <PrimaryButton type="button" disabled={busy} onClick={submitResolve}>
                  {busy ? 'Resolving…' : 'Resolve'}
                </PrimaryButton>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">Reason</div>
              <pre className="text-xs font-mono whitespace-pre-wrap border border-border bg-panel p-3">
                {selected.reason}
              </pre>
            </div>
            <div className="text-[11px] font-mono text-muted">
              Created {formatTime(selected.created_at)}
              {selected.resolved && (
                <>
                  {' · Resolved '}
                  {formatTime(selected.resolved_at)}
                </>
              )}
            </div>
            {selected.resolved ? (
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">
                  Resolution note
                </div>
                <div className="text-xs whitespace-pre-wrap font-mono border border-border bg-panel p-3">
                  {selected.resolved_note ?? '—'}
                </div>
              </div>
            ) : (
              <Field label="Resolution note">
                <TextArea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What was done to resolve this?"
                />
              </Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
