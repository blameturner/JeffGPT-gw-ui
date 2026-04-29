import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Field, TextInput } from '../components/Field';
import { PrimaryButton, SecondaryButton } from '../components/Toolbar';
import { rotateSecret } from '../api';
import type { Secret } from '../types';

export function RotateSecretModal({
  open,
  onClose,
  secret,
  onRotated,
}: {
  open: boolean;
  onClose: () => void;
  secret: Secret | null;
  onRotated: (next: Secret) => void;
}) {
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setShowValue(false);
    setConfirmed(false);
    setSubmitting(false);
    setError(null);
  }, [open]);

  const canSubmit = !submitting && value.length > 0 && confirmed && secret != null;

  async function handleSubmit() {
    if (!canSubmit || !secret) return;
    setSubmitting(true);
    setError(null);
    try {
      const next = await rotateSecret(secret.id, value);
      onRotated(next);
      onClose();
    } catch (e) {
      console.error('rotateSecret failed', e);
      setError((e as Error).message || 'Failed to rotate secret.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={secret ? `Rotate ${secret.name}` : 'Rotate secret'}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Rotating…' : 'Rotate secret'}
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

        <p className="text-xs text-muted">
          Replace the stored value. The previous value is discarded immediately.
        </p>

        <Field label="New value" required>
          <div className="flex gap-2">
            <TextInput
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste new secret value"
              className="font-mono flex-1"
              autoComplete="new-password"
              spellCheck={false}
              autoFocus
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

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>I understand existing references will use the new value.</span>
        </label>
      </div>
    </Modal>
  );
}
