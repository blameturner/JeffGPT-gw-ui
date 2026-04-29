import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Field, SelectInput, TextArea, TextInput, Toggle } from '../components/Field';
import { PrimaryButton, SecondaryButton } from '../components/Toolbar';
import { SecretRefSelect } from '../components/SecretRefSelect';
import { StatusChip } from '../components/StatusChip';
import { createSecret, registerSmtp, testSmtp } from '../api';
import type { ConnectorStatus, SecretKind, SmtpAccount, SmtpTestResult } from '../types';

const SECRET_KINDS: SecretKind[] = [
  'password',
  'api_key',
  'oauth_token',
  'webhook_secret',
  'private_key',
  'certificate',
  'other',
];

interface FormState {
  name: string;
  description: string;
  fromEmail: string;
  host: string;
  port: number;
  useTls: boolean;
  useStarttls: boolean;
  username: string;
  passwordSecretRef: string | null;
  imapEnabled: boolean;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPasswordSecretRef: string | null;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  fromEmail: '',
  host: '',
  port: 587,
  useTls: false,
  useStarttls: true,
  username: '',
  passwordSecretRef: null,
  imapEnabled: false,
  imapHost: '',
  imapPort: 993,
  imapUsername: '',
  imapPasswordSecretRef: null,
};

function TestResultLine({
  status,
  note,
}: {
  status: ConnectorStatus;
  note?: string | null;
}) {
  const isErr = status === 'failed';
  return (
    <div
      className={[
        'border rounded px-3 py-2 text-xs flex items-start gap-3',
        isErr ? 'border-red-200 bg-red-50 text-red-800' : 'border-border bg-panel text-fg',
      ].join(' ')}
    >
      <StatusChip status={status} />
      <span className={isErr ? 'text-red-800' : 'text-muted'}>
        {note ?? (isErr ? 'Test failed.' : 'Test completed.')}
      </span>
    </div>
  );
}

export function RegisterSmtpModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (newId: number) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [imapSecretModalOpen, setImapSecretModalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
      setCreatedId(null);
      setTestResult(null);
      setBusy(false);
      setTesting(false);
    }
  }, [open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Mutually-aware TLS toggles: turning one on dims (does not disable) the other.
  function setUseTls(next: boolean) {
    setForm((f) => ({ ...f, useTls: next, useStarttls: next ? false : f.useStarttls }));
  }
  function setUseStarttls(next: boolean) {
    setForm((f) => ({ ...f, useStarttls: next, useTls: next ? false : f.useTls }));
  }

  const bothOff = !form.useTls && !form.useStarttls;
  const canSubmit =
    form.name.trim().length > 0 &&
    form.fromEmail.trim().length > 0 &&
    form.host.trim().length > 0 &&
    form.port > 0 &&
    !busy &&
    createdId == null;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Partial<SmtpAccount> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        from_email: form.fromEmail.trim(),
        host: form.host.trim(),
        port: form.port,
        use_tls: form.useTls,
        use_starttls: form.useStarttls,
        username: form.username.trim() || null,
        password_secret_ref: form.passwordSecretRef ?? null,
        imap_enabled: form.imapEnabled,
        imap_host: form.imapEnabled ? form.imapHost.trim() || null : null,
        imap_port: form.imapEnabled ? form.imapPort : null,
        imap_username: form.imapEnabled ? form.imapUsername.trim() || null : null,
        imap_password_secret_ref: form.imapEnabled
          ? form.imapPasswordSecretRef ?? form.passwordSecretRef ?? null
          : null,
      };
      const created = await registerSmtp(payload);
      setCreatedId(created.id);
      setTesting(true);
      try {
        const res = await testSmtp(created.id);
        setTestResult(res);
      } catch (e) {
        console.error('testSmtp failed', e);
        setTestResult({
          status: 'failed',
          note: (e as Error).message || 'Test failed.',
        });
      } finally {
        setTesting(false);
      }
    } catch (e) {
      console.error('registerSmtp failed', e);
      setError((e as Error).message || 'Failed to register SMTP account.');
    } finally {
      setBusy(false);
    }
  }

  function handleDone() {
    if (createdId != null) onCreated(createdId);
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={busy || testing ? () => undefined : onClose}
        title="Register SMTP"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton onClick={onClose} disabled={busy || testing}>
              Close
            </SecondaryButton>
            {createdId == null ? (
              <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
                {busy ? 'Registering…' : 'Register & test'}
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={handleDone} disabled={testing}>
                {testing ? 'Testing…' : 'Done'}
              </PrimaryButton>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          {createdId != null && (
            <div className="space-y-2">
              {testing && (
                <div className="border border-border bg-panel text-xs px-3 py-2 rounded text-muted">
                  Sending test email…
                </div>
              )}
              {testResult && <TestResultLine status={testResult.status} note={testResult.note} />}
            </div>
          )}

          {/* Mailbox */}
          <section className="border border-border rounded-md p-4 space-y-3">
            <h3 className="font-display text-base">Mailbox</h3>
            <Field label="Name" required>
              <TextInput
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="primary-outbound"
                disabled={createdId != null}
              />
            </Field>
            <Field label="Description">
              <TextArea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                disabled={createdId != null}
              />
            </Field>
            <Field label="From email" required>
              <TextInput
                type="email"
                value={form.fromEmail}
                onChange={(e) => update('fromEmail', e.target.value)}
                placeholder="agent@example.com"
                className="font-mono"
                disabled={createdId != null}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Host" required>
                <TextInput
                  value={form.host}
                  onChange={(e) => update('host', e.target.value)}
                  placeholder="smtp.example.com"
                  className="font-mono"
                  disabled={createdId != null}
                />
              </Field>
              <Field label="Port" required>
                <TextInput
                  type="number"
                  value={form.port}
                  onChange={(e) => update('port', Number(e.target.value) || 0)}
                  className="font-mono"
                  disabled={createdId != null}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={form.useStarttls ? 'opacity-50' : ''}>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={form.useTls}
                    onChange={setUseTls}
                    disabled={createdId != null}
                    label="Implicit TLS"
                  />
                  <div>
                    <div className="text-sm">Implicit TLS</div>
                    <div className="text-[11px] text-muted">implicit TLS, port 465</div>
                  </div>
                </div>
              </div>
              <div className={form.useTls ? 'opacity-50' : ''}>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={form.useStarttls}
                    onChange={setUseStarttls}
                    disabled={createdId != null}
                    label="STARTTLS"
                  />
                  <div>
                    <div className="text-sm">STARTTLS</div>
                    <div className="text-[11px] text-muted">STARTTLS, port 587</div>
                  </div>
                </div>
              </div>
            </div>
            {bothOff && (
              <div className="text-[11px] text-amber-700">
                Warning: both TLS and STARTTLS are off. Email will be sent in cleartext.
              </div>
            )}
          </section>

          {/* Credentials */}
          <section className="border border-border rounded-md p-4 space-y-3">
            <h3 className="font-display text-base">Credentials</h3>
            <Field label="Username">
              <TextInput
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                className="font-mono"
                disabled={createdId != null}
              />
            </Field>
            <Field label="Password secret">
              <SecretRefSelect
                value={form.passwordSecretRef}
                onChange={(v) => update('passwordSecretRef', v)}
                onCreateNew={() => setSecretModalOpen(true)}
                disabled={createdId != null}
              />
            </Field>
          </section>

          {/* IMAP */}
          <section className="border border-border rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base">IMAP (optional)</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">Confirm receipt via IMAP.</span>
                <Toggle
                  checked={form.imapEnabled}
                  onChange={(v) => update('imapEnabled', v)}
                  disabled={createdId != null}
                  label="Enable IMAP"
                />
              </div>
            </div>
            {form.imapEnabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="IMAP host">
                    <TextInput
                      value={form.imapHost}
                      onChange={(e) => update('imapHost', e.target.value)}
                      placeholder="imap.example.com"
                      className="font-mono"
                      disabled={createdId != null}
                    />
                  </Field>
                  <Field label="IMAP port">
                    <TextInput
                      type="number"
                      value={form.imapPort}
                      onChange={(e) => update('imapPort', Number(e.target.value) || 0)}
                      className="font-mono"
                      disabled={createdId != null}
                    />
                  </Field>
                </div>
                <Field label="IMAP username">
                  <TextInput
                    value={form.imapUsername}
                    onChange={(e) => update('imapUsername', e.target.value)}
                    placeholder="= SMTP username if blank"
                    className="font-mono"
                    disabled={createdId != null}
                  />
                </Field>
                <Field label="IMAP password secret">
                  <SecretRefSelect
                    value={form.imapPasswordSecretRef ?? form.passwordSecretRef}
                    onChange={(v) => update('imapPasswordSecretRef', v)}
                    onCreateNew={() => setImapSecretModalOpen(true)}
                    disabled={createdId != null}
                  />
                </Field>
                <p className="text-[11px] text-muted">
                  Test will poll the inbox for the self-test message and confirm receipt.
                </p>
              </>
            )}
          </section>

          {error && (
            <div className="border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2 rounded">
              {error}
            </div>
          )}
        </div>
      </Modal>

      <NewSecretInline
        open={secretModalOpen}
        onClose={() => setSecretModalOpen(false)}
        initialName=""
        onCreated={(name) => {
          update('passwordSecretRef', name);
          setSecretModalOpen(false);
        }}
      />
      <NewSecretInline
        open={imapSecretModalOpen}
        onClose={() => setImapSecretModalOpen(false)}
        initialName=""
        onCreated={(name) => {
          update('imapPasswordSecretRef', name);
          setImapSecretModalOpen(false);
        }}
      />
    </>
  );
}

function NewSecretInline({
  open,
  onClose,
  initialName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialName: string;
  onCreated: (secretName: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<SecretKind>('password');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setKind('password');
      setValue('');
      setError(null);
      setBusy(false);
    }
  }, [open, initialName]);

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
