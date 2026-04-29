import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { Field, SelectInput, TextArea, TextInput, Toggle } from '../components/Field';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Toolbar';
import { AuthFields, type AuthFieldsValue } from './AuthFields';
import { createSecret, inspectApi, registerApi } from '../api';
import type { ApiAuthType, ApiConnection, SecretKind } from '../types';

type Step = 1 | 2 | 3;

interface BasicsState {
  name: string;
  description: string;
  base_url: string;
}

const SECRET_KINDS: SecretKind[] = [
  'api_key',
  'oauth_token',
  'password',
  'webhook_secret',
  'private_key',
  'certificate',
  'other',
];

export function RegisterApiWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [step, setStep] = useState<Step>(1);

  const [basics, setBasics] = useState<BasicsState>({ name: '', description: '', base_url: '' });
  const [auth, setAuth] = useState<AuthFieldsValue>({
    authType: 'none' as ApiAuthType,
    authSecretRef: null,
    authExtra: {},
  });
  const [openapiUrl, setOpenapiUrl] = useState('');
  const [inspectAfter, setInspectAfter] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Inline new-secret modal state
  const [newSecretOpen, setNewSecretOpen] = useState(false);

  function reset() {
    setStep(1);
    setBasics({ name: '', description: '', base_url: '' });
    setAuth({ authType: 'none', authSecretRef: null, authExtra: {} });
    setOpenapiUrl('');
    setInspectAfter(true);
    setBusy(false);
    setError(null);
    setProgress(null);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  // ---- Validation per step ----
  const basicsErrors = useMemo(() => {
    const errs: { name?: string; base_url?: string } = {};
    if (!basics.name.trim()) errs.name = 'Name is required.';
    try {
      // throws on invalid
      // eslint-disable-next-line no-new
      new URL(basics.base_url);
    } catch {
      errs.base_url = 'Must be a valid URL (including scheme).';
    }
    return errs;
  }, [basics]);

  const authErrors = useMemo(() => {
    const errs: { auth?: string } = {};
    const { authType, authSecretRef, authExtra } = auth;
    if (authType === 'bearer' && !authSecretRef) errs.auth = 'Token secret is required.';
    if (authType === 'basic') {
      if (!authExtra.username || typeof authExtra.username !== 'string' || !authExtra.username.trim()) {
        errs.auth = 'Username is required.';
      } else if (!authSecretRef) errs.auth = 'Password secret is required.';
    }
    if (authType === 'api_key_header') {
      if (!authExtra.header_name) errs.auth = 'Header name is required.';
      else if (!authSecretRef) errs.auth = 'Key secret is required.';
    }
    if (authType === 'api_key_query') {
      if (!authExtra.query_name) errs.auth = 'Query name is required.';
      else if (!authSecretRef) errs.auth = 'Key secret is required.';
    }
    if (authType === 'oauth2') {
      if (!authExtra.token_url) errs.auth = 'Token URL is required.';
      else if (!authSecretRef) errs.auth = 'Client secret is required.';
    }
    return errs;
  }, [auth]);

  const canNext =
    (step === 1 && Object.keys(basicsErrors).length === 0) ||
    (step === 2 && Object.keys(authErrors).length === 0) ||
    step === 3;

  async function submit() {
    setBusy(true);
    setError(null);
    setProgress('Registering…');
    try {
      const payload: Partial<ApiConnection> = {
        name: basics.name.trim(),
        description: basics.description.trim() || null,
        base_url: basics.base_url.trim(),
        auth_type: auth.authType,
        auth_secret_ref: auth.authSecretRef ?? null,
        auth_extra_json: Object.keys(auth.authExtra).length ? auth.authExtra : null,
        openapi_url: openapiUrl.trim() || null,
      };
      const created = await registerApi(payload);

      if (inspectAfter) {
        setProgress('Inspecting…');
        try {
          await inspectApi(created.id);
        } catch (e) {
          // Non-fatal: registration succeeded. Surface message but proceed.
          console.error('inspect after register failed', e);
        }
      }

      onCreated(created.id);
      reset();
      onClose();
    } catch (e) {
      console.error('register failed', e);
      setError((e as Error).message || 'Failed to register API.');
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Register API"
        size="full"
        footer={
          <div className="flex items-center justify-between gap-3">
            <GhostButton onClick={handleClose} disabled={busy}>
              Cancel
            </GhostButton>
            <div className="flex items-center gap-2">
              {progress && <span className="text-[11px] text-muted font-mono">{progress}</span>}
              {step > 1 && (
                <SecondaryButton onClick={() => setStep((s) => (s - 1) as Step)} disabled={busy}>
                  Back
                </SecondaryButton>
              )}
              {step < 3 && (
                <PrimaryButton
                  onClick={() => canNext && setStep((s) => (s + 1) as Step)}
                  disabled={!canNext || busy}
                >
                  Next
                </PrimaryButton>
              )}
              {step === 3 && (
                <PrimaryButton onClick={submit} disabled={busy}>
                  {busy ? 'Submitting…' : 'Register'}
                </PrimaryButton>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <Stepper step={step} />

          {error && (
            <div className="border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2 rounded">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 max-w-xl">
              <Field label="Name" required error={basicsErrors.name}>
                <TextInput
                  value={basics.name}
                  onChange={(e) => setBasics((b) => ({ ...b, name: e.target.value }))}
                  invalid={!!basicsErrors.name}
                  placeholder="Stripe (production)"
                />
              </Field>
              <Field label="Description" hint="Short note shown to other admins.">
                <TextArea
                  value={basics.description}
                  onChange={(e) => setBasics((b) => ({ ...b, description: e.target.value }))}
                  rows={3}
                />
              </Field>
              <Field label="Base URL" required error={basicsErrors.base_url}>
                <TextInput
                  value={basics.base_url}
                  onChange={(e) => setBasics((b) => ({ ...b, base_url: e.target.value }))}
                  invalid={!!basicsErrors.base_url}
                  placeholder="https://api.example.com"
                  className="font-mono"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 max-w-xl">
              <AuthFields
                authType={auth.authType}
                authSecretRef={auth.authSecretRef}
                authExtra={auth.authExtra}
                onChange={setAuth}
                onCreateNewSecret={() => setNewSecretOpen(true)}
              />
              {authErrors.auth && (
                <div className="text-[11px] text-red-700">{authErrors.auth}</div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 max-w-xl">
              <Field
                label="OpenAPI URL"
                hint="Optional. If provided, inspection will fetch and parse this spec."
              >
                <TextInput
                  value={openapiUrl}
                  onChange={(e) => setOpenapiUrl(e.target.value)}
                  placeholder="https://api.example.com/openapi.json"
                  className="font-mono"
                />
              </Field>

              <div className="flex items-start gap-3 border border-border rounded p-3">
                <Toggle
                  checked={inspectAfter}
                  onChange={setInspectAfter}
                  label="Inspect after register"
                />
                <div className="text-sm">
                  <div className="font-sans">Inspect now and have an LLM write the usage prompt?</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    We'll probe the base URL (and OpenAPI if given) and draft a usage prompt for agents.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <NewSecretInline
        open={newSecretOpen}
        onClose={() => setNewSecretOpen(false)}
        initialName=""
        onCreated={(name) => {
          setAuth((prev) => ({ ...prev, authSecretRef: name }));
          setNewSecretOpen(false);
        }}
      />
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 1, label: 'Basics' },
    { id: 2, label: 'Auth' },
    { id: 3, label: 'Discovery' },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={[
              'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono border',
              s.id === step ? 'bg-fg text-bg border-fg' : s.id < step ? 'bg-panel border-fg text-fg' : 'border-border text-muted',
            ].join(' ')}
          >
            {s.id}
          </span>
          <span
            className={[
              'text-[11px] uppercase tracking-[0.18em] font-sans',
              s.id === step ? 'text-fg' : 'text-muted',
            ].join(' ')}
          >
            {s.label}
          </span>
          {idx < steps.length - 1 && <span className="w-8 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
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
  const [kind, setKind] = useState<SecretKind>('api_key');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !value) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createSecret({ name: name.trim(), kind, value });
      onCreated(created.name);
      setName('');
      setValue('');
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
            placeholder="stripe_live_key"
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
