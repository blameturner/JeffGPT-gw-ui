import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from '../components/Drawer';
import { StatusChip } from '../components/StatusChip';
import { DangerZone } from '../components/DangerZone';
import { Field, TextArea, TextInput, Toggle } from '../components/Field';
import { Modal } from '../components/Modal';
import { SelectInput } from '../components/Field';
import { GhostButton, PrimaryButton, SecondaryButton } from '../components/Toolbar';
import { SecretRefSelect } from '../components/SecretRefSelect';
import {
  createSecret,
  deleteSmtp,
  getSmtp,
  patchSmtp,
  testSmtp,
} from '../api';
import type { SecretKind, SmtpAccount, SmtpTestResult } from '../types';

const SECRET_KINDS: SecretKind[] = [
  'password',
  'api_key',
  'oauth_token',
  'webhook_secret',
  'private_key',
  'certificate',
  'other',
];

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  if (sec < 60) return `${sec}s ${diff >= 0 ? 'ago' : 'from now'}`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ${diff >= 0 ? 'ago' : 'from now'}`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ${diff >= 0 ? 'ago' : 'from now'}`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day}d ${diff >= 0 ? 'ago' : 'from now'}`;
  const mo = Math.round(day / 30);
  return `${mo}mo ${diff >= 0 ? 'ago' : 'from now'}`;
}

function fmtAbsolute(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

interface MailboxDraft {
  name: string;
  description: string;
  fromEmail: string;
  host: string;
  port: number;
  useTls: boolean;
  useStarttls: boolean;
}

interface CredentialsDraft {
  username: string;
  passwordSecretRef: string | null;
}

interface ImapDraft {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  passwordSecretRef: string | null;
}

function mailboxFromAccount(a: SmtpAccount): MailboxDraft {
  return {
    name: a.name,
    description: a.description ?? '',
    fromEmail: a.from_email,
    host: a.host,
    port: a.port,
    useTls: Boolean(a.use_tls),
    useStarttls: Boolean(a.use_starttls),
  };
}

function credentialsFromAccount(a: SmtpAccount): CredentialsDraft {
  return {
    username: a.username ?? '',
    passwordSecretRef: a.password_secret_ref ?? null,
  };
}

function imapFromAccount(a: SmtpAccount): ImapDraft {
  return {
    enabled: Boolean(a.imap_enabled),
    host: a.imap_host ?? '',
    port: a.imap_port ?? 993,
    username: a.imap_username ?? '',
    passwordSecretRef: a.imap_password_secret_ref ?? null,
  };
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  for (const k of Object.keys(a)) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function SmtpDetailDrawer({
  open,
  smtpId,
  onClose,
  onChanged,
  onDeleted,
}: {
  open: boolean;
  smtpId: number | null;
  onClose: () => void;
  onChanged: (smtp: SmtpAccount) => void;
  onDeleted: (id: number) => void;
}) {
  const [smtp, setSmtp] = useState<SmtpAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inline name editor
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Section drafts
  const [mailbox, setMailbox] = useState<MailboxDraft | null>(null);
  const [creds, setCreds] = useState<CredentialsDraft | null>(null);
  const [imap, setImap] = useState<ImapDraft | null>(null);

  // Save state
  const [savingMailbox, setSavingMailbox] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [savingImap, setSavingImap] = useState(false);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testStatusText, setTestStatusText] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [highlightTest, setHighlightTest] = useState(false);

  // Kebab + danger
  const [kebabOpen, setKebabOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement | null>(null);
  const [showDanger, setShowDanger] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Inline secret create
  const [secretModal, setSecretModal] = useState<null | 'creds' | 'imap'>(null);

  // Per-section save notice
  const [notice, setNotice] = useState<{ section: string; kind: 'ok' | 'err'; msg: string } | null>(
    null,
  );

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load + reset on open / id change
  useEffect(() => {
    if (!open || smtpId == null) {
      setSmtp(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getSmtp(smtpId)
      .then((res) => {
        if (cancelled) return;
        hydrate(res);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('getSmtp failed', e);
        setLoadError((e as Error).message || 'Failed to load SMTP account.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, smtpId]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Close kebab on outside click
  useEffect(() => {
    if (!kebabOpen) return;
    function onDoc(e: MouseEvent) {
      if (!kebabRef.current) return;
      if (!kebabRef.current.contains(e.target as Node)) setKebabOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [kebabOpen]);

  function hydrate(a: SmtpAccount) {
    setSmtp(a);
    setMailbox(mailboxFromAccount(a));
    setCreds(credentialsFromAccount(a));
    setImap(imapFromAccount(a));
    setEditingName(false);
    setDraftName(a.name);
    setNotice(null);
    setTestError(null);
  }

  const mailboxDirty = useMemo(() => {
    if (!smtp || !mailbox) return false;
    return !shallowEqual(mailbox as unknown as Record<string, unknown>, mailboxFromAccount(smtp) as unknown as Record<string, unknown>);
  }, [smtp, mailbox]);

  const credsDirty = useMemo(() => {
    if (!smtp || !creds) return false;
    return !shallowEqual(creds as unknown as Record<string, unknown>, credentialsFromAccount(smtp) as unknown as Record<string, unknown>);
  }, [smtp, creds]);

  const imapDirty = useMemo(() => {
    if (!smtp || !imap) return false;
    return !shallowEqual(imap as unknown as Record<string, unknown>, imapFromAccount(smtp) as unknown as Record<string, unknown>);
  }, [smtp, imap]);

  async function saveName() {
    if (!smtp) return;
    const next = draftName.trim();
    if (!next || next === smtp.name) {
      setEditingName(false);
      setDraftName(smtp.name);
      return;
    }
    try {
      const updated = await patchSmtp(smtp.id, { name: next });
      hydrate(updated);
      onChanged(updated);
      setNotice({ section: 'name', kind: 'ok', msg: 'Renamed.' });
    } catch (e) {
      console.error('rename failed', e);
      setNotice({ section: 'name', kind: 'err', msg: (e as Error).message || 'Rename failed.' });
    }
  }

  async function saveMailbox() {
    if (!smtp || !mailbox) return;
    setSavingMailbox(true);
    try {
      const updated = await patchSmtp(smtp.id, {
        name: mailbox.name.trim(),
        description: mailbox.description.trim() || null,
        from_email: mailbox.fromEmail.trim(),
        host: mailbox.host.trim(),
        port: mailbox.port,
        use_tls: mailbox.useTls,
        use_starttls: mailbox.useStarttls,
      });
      hydrate(updated);
      onChanged(updated);
      setNotice({ section: 'mailbox', kind: 'ok', msg: 'Saved.' });
    } catch (e) {
      console.error('save mailbox failed', e);
      setNotice({
        section: 'mailbox',
        kind: 'err',
        msg: (e as Error).message || 'Save failed.',
      });
    } finally {
      setSavingMailbox(false);
    }
  }

  async function saveCreds() {
    if (!smtp || !creds) return;
    setSavingCreds(true);
    try {
      const updated = await patchSmtp(smtp.id, {
        username: creds.username.trim() || null,
        password_secret_ref: creds.passwordSecretRef ?? null,
      });
      hydrate(updated);
      onChanged(updated);
      setNotice({ section: 'creds', kind: 'ok', msg: 'Saved.' });
    } catch (e) {
      console.error('save creds failed', e);
      setNotice({ section: 'creds', kind: 'err', msg: (e as Error).message || 'Save failed.' });
    } finally {
      setSavingCreds(false);
    }
  }

  async function saveImap() {
    if (!smtp || !imap) return;
    setSavingImap(true);
    try {
      const updated = await patchSmtp(smtp.id, {
        imap_enabled: imap.enabled,
        imap_host: imap.enabled ? imap.host.trim() || null : null,
        imap_port: imap.enabled ? imap.port : null,
        imap_username: imap.enabled ? imap.username.trim() || null : null,
        imap_password_secret_ref: imap.enabled ? imap.passwordSecretRef ?? null : null,
      });
      hydrate(updated);
      onChanged(updated);
      setNotice({ section: 'imap', kind: 'ok', msg: 'Saved.' });
    } catch (e) {
      console.error('save imap failed', e);
      setNotice({ section: 'imap', kind: 'err', msg: (e as Error).message || 'Save failed.' });
    } finally {
      setSavingImap(false);
    }
  }

  async function runTest() {
    if (!smtp) return;
    setTesting(true);
    setTestError(null);
    setTestStatusText('Sending test email…');
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (smtp.imap_enabled) {
      pollTimerRef.current = setTimeout(() => {
        setTestStatusText('Polling IMAP for receipt…');
      }, 1500);
    }
    let result: SmtpTestResult | null = null;
    try {
      result = await testSmtp(smtp.id);
    } catch (e) {
      console.error('testSmtp failed', e);
      setTestError((e as Error).message || 'Test failed.');
    } finally {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      setTesting(false);
      setTestStatusText(null);
    }

    // Refetch authoritative record after test.
    try {
      const fresh = await getSmtp(smtp.id);
      hydrate(fresh);
      onChanged(fresh);
      if (fresh.status && fresh.status !== 'verified' && fresh.verification_note) {
        setTestError(fresh.verification_note);
      } else if (result && result.status !== 'verified' && result.note) {
        setTestError(result.note);
      }
    } catch (e) {
      console.error('refetch after test failed', e);
    }

    setHighlightTest(true);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightTest(false), 1100);
  }

  async function handleDelete() {
    if (!smtp) return;
    setDeleting(true);
    try {
      await deleteSmtp(smtp.id);
      onDeleted(smtp.id);
      onClose();
    } catch (e) {
      console.error('delete failed', e);
      setNotice({
        section: 'danger',
        kind: 'err',
        msg: (e as Error).message || 'Delete failed.',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} label="SMTP details">
      {loading || !smtp ? (
        <div className="p-6 space-y-2">
          {loadError ? (
            <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 rounded">
              {loadError}
            </div>
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-9 bg-panel border border-border rounded-md animate-pulse"
              />
            ))
          )}
        </div>
      ) : (
        <>
          <DrawerHeader
            onClose={onClose}
            title={
              editingName ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') {
                      setEditingName(false);
                      setDraftName(smtp.name);
                    }
                  }}
                  className="font-display text-xl tracking-tightest bg-bg border-b border-fg outline-none w-full"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-left hover:text-muted transition-colors"
                  title="Click to rename"
                >
                  {smtp.name}
                </button>
              )
            }
            subtitle={smtp.from_email}
            actions={
              <>
                <StatusChip status={smtp.status} />
                <PrimaryButton onClick={runTest} disabled={testing}>
                  {testing ? 'Testing…' : 'Send Test'}
                </PrimaryButton>
                <div ref={kebabRef} className="relative">
                  <button
                    type="button"
                    aria-label="More actions"
                    onClick={() => setKebabOpen((s) => !s)}
                    className="text-muted hover:text-fg px-2 py-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                  {kebabOpen && (
                    <div className="absolute right-0 top-full mt-1 z-20 border border-border bg-bg shadow-card min-w-[140px]">
                      <button
                        type="button"
                        onClick={() => {
                          setKebabOpen(false);
                          setEditingName(true);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-panelHi"
                      >
                        Edit name
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKebabOpen(false);
                          setShowDanger(true);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-panelHi text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </>
            }
          />

          <DrawerBody>
            {testStatusText && (
              <div className="border border-border bg-panel text-xs px-3 py-2 rounded text-muted">
                {testStatusText}
              </div>
            )}
            {testError && (
              <div className="border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2 rounded">
                {testError}
              </div>
            )}

            {notice && (
              <div
                className={[
                  'text-xs px-3 py-2 rounded border',
                  notice.kind === 'ok'
                    ? 'border-border bg-panel text-muted'
                    : 'border-red-200 bg-red-50 text-red-800',
                ].join(' ')}
              >
                {notice.section}: {notice.msg}
              </div>
            )}

            {/* Mailbox */}
            {mailbox && (
              <section className="border border-border rounded-md p-4 space-y-3">
                <h3 className="font-display text-base">Mailbox</h3>
                <Field label="Name" required>
                  <TextInput
                    value={mailbox.name}
                    onChange={(e) => setMailbox({ ...mailbox, name: e.target.value })}
                  />
                </Field>
                <Field label="Description">
                  <TextArea
                    rows={2}
                    value={mailbox.description}
                    onChange={(e) =>
                      setMailbox({ ...mailbox, description: e.target.value })
                    }
                  />
                </Field>
                <Field label="From email" required>
                  <TextInput
                    type="email"
                    className="font-mono"
                    value={mailbox.fromEmail}
                    onChange={(e) =>
                      setMailbox({ ...mailbox, fromEmail: e.target.value })
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Host" required>
                    <TextInput
                      className="font-mono"
                      value={mailbox.host}
                      onChange={(e) => setMailbox({ ...mailbox, host: e.target.value })}
                    />
                  </Field>
                  <Field label="Port" required>
                    <TextInput
                      type="number"
                      className="font-mono"
                      value={mailbox.port}
                      onChange={(e) =>
                        setMailbox({ ...mailbox, port: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={mailbox.useStarttls ? 'opacity-50' : ''}>
                    <div className="flex items-center gap-3">
                      <Toggle
                        checked={mailbox.useTls}
                        onChange={(v) =>
                          setMailbox({
                            ...mailbox,
                            useTls: v,
                            useStarttls: v ? false : mailbox.useStarttls,
                          })
                        }
                        label="Implicit TLS"
                      />
                      <div>
                        <div className="text-sm">Implicit TLS</div>
                        <div className="text-[11px] text-muted">implicit TLS, port 465</div>
                      </div>
                    </div>
                  </div>
                  <div className={mailbox.useTls ? 'opacity-50' : ''}>
                    <div className="flex items-center gap-3">
                      <Toggle
                        checked={mailbox.useStarttls}
                        onChange={(v) =>
                          setMailbox({
                            ...mailbox,
                            useStarttls: v,
                            useTls: v ? false : mailbox.useTls,
                          })
                        }
                        label="STARTTLS"
                      />
                      <div>
                        <div className="text-sm">STARTTLS</div>
                        <div className="text-[11px] text-muted">STARTTLS, port 587</div>
                      </div>
                    </div>
                  </div>
                </div>
                {!mailbox.useTls && !mailbox.useStarttls && (
                  <div className="text-[11px] text-amber-700">
                    Warning: both TLS and STARTTLS are off. Email will be sent in cleartext.
                  </div>
                )}
                <div className="flex justify-end">
                  <PrimaryButton
                    onClick={saveMailbox}
                    disabled={!mailboxDirty || savingMailbox}
                  >
                    {savingMailbox ? 'Saving…' : 'Save mailbox'}
                  </PrimaryButton>
                </div>
              </section>
            )}

            {/* Credentials */}
            {creds && (
              <section className="border border-border rounded-md p-4 space-y-3">
                <h3 className="font-display text-base">Credentials</h3>
                <Field label="Username">
                  <TextInput
                    className="font-mono"
                    value={creds.username}
                    onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                  />
                </Field>
                <Field label="Password secret">
                  <SecretRefSelect
                    value={creds.passwordSecretRef}
                    onChange={(v) => setCreds({ ...creds, passwordSecretRef: v })}
                    onCreateNew={() => setSecretModal('creds')}
                  />
                </Field>
                <div className="flex justify-end">
                  <PrimaryButton
                    onClick={saveCreds}
                    disabled={!credsDirty || savingCreds}
                  >
                    {savingCreds ? 'Saving…' : 'Save credentials'}
                  </PrimaryButton>
                </div>
              </section>
            )}

            {/* IMAP */}
            {imap && (
              <section className="border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-base">IMAP (optional)</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">Confirm receipt via IMAP.</span>
                    <Toggle
                      checked={imap.enabled}
                      onChange={(v) => setImap({ ...imap, enabled: v })}
                      label="Enable IMAP"
                    />
                  </div>
                </div>
                {imap.enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="IMAP host">
                        <TextInput
                          className="font-mono"
                          value={imap.host}
                          onChange={(e) => setImap({ ...imap, host: e.target.value })}
                        />
                      </Field>
                      <Field label="IMAP port">
                        <TextInput
                          type="number"
                          className="font-mono"
                          value={imap.port}
                          onChange={(e) =>
                            setImap({ ...imap, port: Number(e.target.value) || 0 })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="IMAP username">
                      <TextInput
                        className="font-mono"
                        placeholder="= SMTP username if blank"
                        value={imap.username}
                        onChange={(e) => setImap({ ...imap, username: e.target.value })}
                      />
                    </Field>
                    <Field label="IMAP password secret">
                      <SecretRefSelect
                        value={imap.passwordSecretRef ?? creds?.passwordSecretRef ?? null}
                        onChange={(v) => setImap({ ...imap, passwordSecretRef: v })}
                        onCreateNew={() => setSecretModal('imap')}
                      />
                    </Field>
                    <p className="text-[11px] text-muted">
                      Test will poll the inbox for the self-test message and confirm receipt.
                    </p>
                  </>
                )}
                <div className="flex justify-end">
                  <PrimaryButton
                    onClick={saveImap}
                    disabled={!imapDirty || savingImap}
                  >
                    {savingImap ? 'Saving…' : 'Save IMAP'}
                  </PrimaryButton>
                </div>
              </section>
            )}

            {/* Last test */}
            <section
              className={[
                'border rounded-md p-4 space-y-3 transition-colors',
                highlightTest ? 'border-amber-400' : 'border-border',
              ].join(' ')}
            >
              <h3 className="font-display text-base">Last test</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-sans mb-1">
                    Verified at
                  </div>
                  <div className="font-mono" title={fmtAbsolute(smtp.verified_at)}>
                    {fmtRelative(smtp.verified_at)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-sans mb-1">
                    Verification status
                  </div>
                  <div className="font-mono">{smtp.verification_status ?? '—'}</div>
                </div>
              </div>
              {smtp.verification_note && (
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-sans mb-1">
                    Note
                  </div>
                  <pre className="border border-border bg-panel rounded p-3 text-xs whitespace-pre-wrap font-mono">
                    {smtp.verification_note}
                  </pre>
                </div>
              )}
              {smtp.last_test_message_id && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted font-sans">
                    Message id
                  </span>
                  <code className="font-mono text-xs truncate">
                    {smtp.last_test_message_id}
                  </code>
                  <CopyButton value={smtp.last_test_message_id} />
                </div>
              )}
            </section>

            {/* Used by */}
            <section className="border border-border rounded-md p-4 space-y-3">
              <h3 className="font-display text-base">Used by</h3>
              {smtp.used_by_agents && smtp.used_by_agents.length > 0 ? (
                <ul className="space-y-1">
                  {smtp.used_by_agents.map((agent) => (
                    <li key={agent.id}>
                      <Link
                        to="/agents/$id"
                        params={{ id: String(agent.id) }}
                        search={{ view: undefined, id: undefined }}
                        className="text-sm hover:underline"
                      >
                        {agent.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No agents using this yet.</p>
              )}
            </section>

            {/* Danger zone */}
            <DangerZone
              resourceLabel="SMTP account"
              confirmName={smtp.name}
              onDelete={handleDelete}
              busy={deleting}
            />
            {showDanger && (
              <p className="text-[11px] text-muted">
                Use the danger zone above to confirm deletion.
              </p>
            )}
          </DrawerBody>

          <DrawerFooter>
            <span title={fmtAbsolute(smtp.created_at)}>
              Created {fmtRelative(smtp.created_at)}
            </span>
            <span title={fmtAbsolute(smtp.updated_at)}>
              Updated {fmtRelative(smtp.updated_at)}
            </span>
            <span title={fmtAbsolute(smtp.verified_at)}>
              Last verified {fmtRelative(smtp.verified_at)}
            </span>
          </DrawerFooter>
        </>
      )}

      {smtp && secretModal && (
        <NewSecretInline
          open={secretModal != null}
          onClose={() => setSecretModal(null)}
          onCreated={(name) => {
            if (secretModal === 'creds') {
              if (creds) setCreds({ ...creds, passwordSecretRef: name });
            } else if (secretModal === 'imap') {
              if (imap) setImap({ ...imap, passwordSecretRef: name });
            }
            setSecretModal(null);
          }}
        />
      )}
    </Drawer>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error('copy failed', e);
    }
  }
  return (
    <GhostButton onClick={copy} aria-label="Copy message id">
      {copied ? 'Copied' : 'Copy'}
    </GhostButton>
  );
}

function NewSecretInline({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (secretName: string) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SecretKind>('password');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setKind('password');
      setValue('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    if (!name.trim() || !value) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createSecret({ name: name.trim(), kind, value });
      onCreated(created.name);
    } catch (e) {
      console.error('createSecret failed', e);
      setError((e as Error).message || 'Failed to create secret.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="New secret"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={submit} disabled={busy || !name.trim() || !value}>
            {busy ? 'Creating…' : 'Create secret'}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="smtp_password"
            className="font-mono"
          />
        </Field>
        <Field label="Kind">
          <SelectInput value={kind} onChange={(e) => setKind(e.target.value as SecretKind)}>
            {SECRET_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Value" required hint="Stored encrypted. You can rotate later.">
          <TextInput
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono"
          />
        </Field>
        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2 rounded">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
