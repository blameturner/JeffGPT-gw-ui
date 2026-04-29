import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Field, SelectInput, TextArea, TextInput } from '../components/Field';
import { PrimaryButton, SecondaryButton } from '../components/Toolbar';
import { createSecret } from '../api';
import type { Secret, SecretKind } from '../types';

const KINDS: { value: SecretKind; label: string }[] = [
  { value: 'api_key', label: 'API key' },
  { value: 'oauth_token', label: 'OAuth token' },
  { value: 'password', label: 'Password' },
  { value: 'webhook_secret', label: 'Webhook secret' },
  { value: 'private_key', label: 'Private key' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

const SLUG_RE = /^[a-z0-9_]+$/;

export function NewSecretModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (secret: Secret) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SecretKind>('api_key');
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setKind('api_key');
    setValue('');
    setShowValue(false);
    setDescription('');
    setExpiresAt('');
    setSubmitting(false);
    setError(null);
  }, [open]);

  const nameInvalid = name.length > 0 && !SLUG_RE.test(name);
  const canSubmit =
    !submitting && name.length > 0 && !nameInvalid && value.length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createSecret({
        name,
        kind,
        value,
        description: description.trim() || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      onCreated(created);
      onClose();
    } catch (e) {
      console.error('createSecret failed', e);
      setError((e as Error).message || 'Failed to create secret.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New secret"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create secret'}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 rounded">
            {error}
          </div>
        )}

        <Field
          label="Name"
          required
          hint="Used as the reference key from connectors."
          error={nameInvalid ? 'Use lowercase letters, digits, and underscores.' : undefined}
        >
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my_api_key"
            className="font-mono"
            invalid={nameInvalid}
            autoFocus
          />
        </Field>

        <Field label="Kind" required>
          <SelectInput value={kind} onChange={(e) => setKind(e.target.value as SecretKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Value" required>
          <div className="flex gap-2">
            <TextInput
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste secret value"
              className="font-mono flex-1"
              autoComplete="new-password"
              spellCheck={false}
            />
            <button
              type="button"
              aria-label={showValue ? 'Hide value' : 'Show value'}
              onClick={() => setShowValue((s) => !s)}
              className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border text-fg px-3 py-2 hover:border-fg transition shrink-0"
            >
              {showValue ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>

        <Field label="Description">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about how this secret is used."
            rows={3}
          />
        </Field>

        <Field label="Expires at" hint="Optional. Leave empty for no expiry.">
          <TextInput
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="font-mono"
          />
        </Field>
      </div>
    </Modal>
  );
}
