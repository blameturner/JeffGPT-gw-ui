import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from '../components/Drawer';
import { DangerZone } from '../components/DangerZone';
import { Field, SelectInput, TextArea, TextInput } from '../components/Field';
import { PrimaryButton, SecondaryButton } from '../components/Toolbar';
import { RotateSecretModal } from './RotateSecretModal';
import {
  deleteSecret,
  getSecret,
  patchSecret,
  revealSecret,
} from '../api';
import type { Secret, SecretKind, SecretReferrer } from '../types';

const KINDS: { value: SecretKind; label: string }[] = [
  { value: 'api_key', label: 'API key' },
  { value: 'oauth_token', label: 'OAuth token' },
  { value: 'password', label: 'Password' },
  { value: 'webhook_secret', label: 'Webhook secret' },
  { value: 'private_key', label: 'Private key' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

const REVEAL_DURATION_S = 10;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  const suffix = future ? 'from now' : 'ago';
  if (sec < 60) return `${sec}s ${suffix}`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ${suffix}`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ${suffix}`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day}d ${suffix}`;
  const mo = Math.round(day / 30);
  return `${mo}mo ${suffix}`;
}

function fmtAbsolute(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function expiryClass(iso: string | null | undefined): string {
  if (!iso) return 'text-muted';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'text-muted';
  const diff = t - Date.now();
  if (diff < 0) return 'text-red-700';
  if (diff < FOURTEEN_DAYS_MS) return 'text-amber-700';
  return 'text-fg';
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function KindChip({ kind }: { kind: SecretKind }) {
  return (
    <span
      aria-label={`Secret kind ${kind}`}
      className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-mono border border-border rounded bg-panel"
    >
      {kind}
    </span>
  );
}

type ReferrerKindFilter = 'all' | SecretReferrer['kind'];

export function SecretDetailDrawer({
  open,
  secretId,
  onClose,
  onChanged,
  onDeleted,
}: {
  open: boolean;
  secretId: number | null;
  onClose: () => void;
  onChanged: (secret: Secret) => void;
  onDeleted: (id: number) => void;
}) {
  const [secret, setSecret] = useState<Secret | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Section local edits
  const [kindDraft, setKindDraft] = useState<SecretKind>('api_key');
  const [descDraft, setDescDraft] = useState('');
  const [expiresDraft, setExpiresDraft] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaNotice, setMetaNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // Reveal
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate modal
  const [rotateOpen, setRotateOpen] = useState(false);

  // Used by filter
  const [refFilter, setRefFilter] = useState<ReferrerKindFilter>('all');

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteReferrers, setDeleteReferrers] = useState<SecretReferrer[] | null>(null);

  // Load on open / id change
  useEffect(() => {
    if (!open || secretId == null) {
      setSecret(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getSecret(secretId)
      .then((res) => {
        if (cancelled) return;
        setSecret(res);
        hydrate(res);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('getSecret failed', e);
        setLoadError((e as Error).message || 'Failed to load secret.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, secretId]);

  // Clear reveal countdown timer when drawer closes / secret changes
  useEffect(() => {
    if (!open) clearReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, secretId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  function hydrate(rec: Secret) {
    setKindDraft(rec.kind);
    setDescDraft(rec.description ?? '');
    setExpiresDraft(toDateInputValue(rec.expires_at));
    setMetaNotice(null);
    setDeleteError(null);
    setDeleteReferrers(null);
    setRefFilter('all');
    clearReveal();
  }

  function clearReveal() {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setRevealedValue(null);
    setRevealCountdown(0);
    setRevealError(null);
  }

  // ---- Save metadata ----
  const metaDirty = useMemo(() => {
    if (!secret) return false;
    if (kindDraft !== secret.kind) return true;
    if ((descDraft || '') !== (secret.description ?? '')) return true;
    if (expiresDraft !== toDateInputValue(secret.expires_at)) return true;
    return false;
  }, [secret, kindDraft, descDraft, expiresDraft]);

  async function saveMeta() {
    if (!secret) return;
    setSavingMeta(true);
    setMetaNotice(null);
    try {
      const expiresIso = expiresDraft ? new Date(expiresDraft).toISOString() : null;
      const saved = await patchSecret(secret.id, {
        kind: kindDraft,
        description: descDraft.trim() ? descDraft : null,
        expires_at: expiresIso,
      });
      setSecret(saved);
      onChanged(saved);
      hydrate(saved);
      setMetaNotice({ kind: 'ok', msg: 'Saved.' });
    } catch (e) {
      console.error('patchSecret failed', e);
      setMetaNotice({ kind: 'err', msg: (e as Error).message || 'Save failed.' });
    } finally {
      setSavingMeta(false);
    }
  }

  // ---- Reveal ----
  async function handleReveal() {
    if (!secret || revealing) return;
    setRevealing(true);
    setRevealError(null);
    try {
      const res = await revealSecret(secret.id);
      setRevealedValue(res.value);
      setRevealCountdown(REVEAL_DURATION_S);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      revealTimerRef.current = setInterval(() => {
        setRevealCountdown((c) => {
          if (c <= 1) {
            if (revealTimerRef.current) {
              clearInterval(revealTimerRef.current);
              revealTimerRef.current = null;
            }
            setRevealedValue(null);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e) {
      console.error('revealSecret failed', e);
      setRevealError((e as Error).message || 'Reveal failed.');
    } finally {
      setRevealing(false);
    }
  }

  // ---- Rotate ----
  function handleRotated(next: Secret) {
    setSecret(next);
    onChanged(next);
    hydrate(next);
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!secret) return;
    setDeleting(true);
    setDeleteError(null);
    setDeleteReferrers(null);
    try {
      await deleteSecret(secret.id);
      onDeleted(secret.id);
      onClose();
    } catch (e) {
      console.error('deleteSecret failed', e);
      const msg = (e as Error).message || 'Delete failed.';
      // If the secret is in use, surface referrers from current state.
      if (secret.used_by && secret.used_by.length > 0) {
        setDeleteReferrers(secret.used_by);
      }
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  const usedBy = secret?.used_by ?? [];
  const filteredUsedBy = useMemo(() => {
    if (refFilter === 'all') return usedBy;
    return usedBy.filter((r) => r.kind === refFilter);
  }, [usedBy, refFilter]);

  return (
    <>
      <Drawer open={open} onClose={onClose} label="Secret details">
        {(loading || !secret) && (
          <>
            <DrawerHeader title={loading ? 'Loading…' : 'Secret'} onClose={onClose} />
            <DrawerBody>
              {loading && (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-9 bg-panel border border-border rounded-md animate-pulse" />
                  ))}
                </div>
              )}
              {loadError && (
                <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 rounded">
                  {loadError}
                </div>
              )}
            </DrawerBody>
          </>
        )}

        {secret && (
          <>
            <DrawerHeader
              title={
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base">{secret.name}</span>
                  <KindChip kind={secret.kind} />
                </div>
              }
              subtitle={
                secret.value_length != null ? `${secret.value_length} chars` : undefined
              }
              onClose={onClose}
            />

            <DrawerBody>
              {/* 1. Metadata */}
              <Card title="Details">
                <Field label="Name" hint="Name is immutable after creation.">
                  <TextInput
                    value={secret.name}
                    readOnly
                    disabled
                    className="font-mono opacity-70"
                  />
                </Field>

                <Field label="Kind">
                  <SelectInput
                    value={kindDraft}
                    onChange={(e) => setKindDraft(e.target.value as SecretKind)}
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Description">
                  <TextArea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={3}
                  />
                </Field>

                <Field label="Expires at" hint="Empty for no expiry.">
                  <div className="flex items-center gap-2">
                    <TextInput
                      type="date"
                      value={expiresDraft}
                      onChange={(e) => setExpiresDraft(e.target.value)}
                      className={['font-mono', expiryClass(secret.expires_at)].join(' ')}
                    />
                    {secret.expires_at && (
                      <span
                        className={['text-[11px] font-mono', expiryClass(secret.expires_at)].join(' ')}
                        title={fmtAbsolute(secret.expires_at)}
                      >
                        {fmtRelative(secret.expires_at)}
                      </span>
                    )}
                  </div>
                </Field>

                <Field label="Last rotated">
                  <span
                    className="text-sm font-mono text-muted"
                    title={fmtAbsolute(secret.rotated_at)}
                  >
                    {fmtRelative(secret.rotated_at)}
                  </span>
                </Field>

                <div className="flex items-center justify-end gap-2">
                  {metaNotice && (
                    <span
                      className={[
                        'text-[11px] font-mono',
                        metaNotice.kind === 'ok' ? 'text-emerald-700' : 'text-red-700',
                      ].join(' ')}
                    >
                      {metaNotice.msg}
                    </span>
                  )}
                  <PrimaryButton onClick={saveMeta} disabled={!metaDirty || savingMeta}>
                    {savingMeta ? 'Saving…' : 'Save'}
                  </PrimaryButton>
                </div>
              </Card>

              {/* 2. Value */}
              <Card title="Value">
                <Field label="Stored value">
                  <div className="flex gap-2">
                    <TextInput
                      readOnly
                      value={revealedValue ?? '••••••••'}
                      className="font-mono flex-1"
                      aria-label="Secret value (masked)"
                    />
                    <button
                      type="button"
                      onClick={handleReveal}
                      disabled={revealing || revealedValue != null}
                      aria-label="Reveal secret value"
                      className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border text-fg px-3 py-2 hover:border-fg transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {revealing
                        ? 'Revealing…'
                        : revealedValue != null
                          ? `Re-masks in ${revealCountdown}s`
                          : 'Reveal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotateOpen(true)}
                      aria-label="Rotate secret value"
                      className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border text-fg px-3 py-2 hover:border-fg transition shrink-0"
                    >
                      Rotate
                    </button>
                  </div>
                </Field>
                {revealError && (
                  <div className="border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2 rounded">
                    {revealError}
                  </div>
                )}
                <p className="text-[11px] text-muted">
                  Reveal events are audit-logged on the server.
                </p>
              </Card>

              {/* 3. Used by */}
              <Card title="Used by">
                {usedBy.length > 0 ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <FilterChip
                        active={refFilter === 'all'}
                        onClick={() => setRefFilter('all')}
                        label={`All (${usedBy.length})`}
                      />
                      <FilterChip
                        active={refFilter === 'api_connection'}
                        onClick={() => setRefFilter('api_connection')}
                        label={`api_connection (${usedBy.filter((r) => r.kind === 'api_connection').length})`}
                      />
                      <FilterChip
                        active={refFilter === 'smtp_account'}
                        onClick={() => setRefFilter('smtp_account')}
                        label={`smtp_account (${usedBy.filter((r) => r.kind === 'smtp_account').length})`}
                      />
                    </div>
                    <ul className="space-y-2">
                      {filteredUsedBy.map((r) => (
                        <li
                          key={`${r.kind}-${r.id}`}
                          className="border border-border rounded px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-mono truncate">{r.name}</span>
                          <span
                            aria-label={`Referrer kind ${r.kind}`}
                            className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-mono border border-border rounded bg-panel"
                          >
                            {r.kind}
                          </span>
                        </li>
                      ))}
                      {filteredUsedBy.length === 0 && (
                        <li className="text-xs text-muted">No matches for this filter.</li>
                      )}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-muted">Not referenced — safe to delete.</p>
                )}
              </Card>

              {/* 4. Danger zone */}
              <DangerZone
                resourceLabel="secret"
                confirmName={secret.name}
                onDelete={handleDelete}
                busy={deleting}
              />
              {deleteError && (
                <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 rounded space-y-1">
                  <div>{deleteError}</div>
                  {deleteReferrers && deleteReferrers.length > 0 && (
                    <div className="text-xs font-mono">
                      In use by: {deleteReferrers.map((r) => r.name).join(', ')}. Remove
                      references first.
                    </div>
                  )}
                </div>
              )}
            </DrawerBody>

            <DrawerFooter>
              <span title={fmtAbsolute(secret.created_at)}>
                Created {fmtRelative(secret.created_at)}
              </span>
              <span title={fmtAbsolute(secret.updated_at)}>
                Updated {fmtRelative(secret.updated_at)}
              </span>
              <span title={fmtAbsolute(secret.rotated_at)}>
                Rotated {fmtRelative(secret.rotated_at)}
              </span>
            </DrawerFooter>
          </>
        )}
      </Drawer>

      <RotateSecretModal
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        secret={secret}
        onRotated={handleRotated}
      />
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-md p-4 space-y-3">
      <h3 className="font-display text-base tracking-tightest">{title}</h3>
      {children}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Filter ${label}`}
      aria-pressed={active}
      className={[
        'text-[10px] uppercase tracking-[0.12em] font-mono border px-2 py-1 transition-colors',
        active ? 'border-fg bg-fg text-bg' : 'border-border text-muted hover:text-fg hover:border-fg',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// Re-export type for clarity in consumers (none external currently)
export type { ReferrerKindFilter };
