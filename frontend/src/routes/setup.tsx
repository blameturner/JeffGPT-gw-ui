import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../lib/api';

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function SetupPage() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.setup({ orgName, slug: slug || slugify(orgName), email, password, displayName });
      navigate({ to: '/login' });
    } catch (err: any) {
      setError(err?.message ?? 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold mb-1">
          Welcome to <span className="text-accent">JeffGPT</span>
        </h1>
        <p className="text-muted mb-8">Create your organisation to get started.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Organisation name">
            <input
              className="input"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                if (!slugDirty) setSlug(slugify(e.target.value));
              }}
              required
            />
          </Field>
          <Field label="Slug">
            <input
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugDirty(true);
              }}
              required
            />
          </Field>
          <Field label="Your name">
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-bg font-semibold py-2.5 rounded-md hover:bg-amber-400 transition disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create organisation'}
          </button>
        </form>
      </div>
      <style>{`
        .input {
          width: 100%;
          background: #242424;
          border: 1px solid #333;
          padding: 0.55rem 0.75rem;
          border-radius: 0.375rem;
          color: #e7e5e4;
          outline: none;
        }
        .input:focus { border-color: #f59e0b; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

export const Route = createFileRoute('/setup')({ component: SetupPage });
