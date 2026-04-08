import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../lib/auth-client';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? 'Sign in failed');
      return;
    }
    navigate({ to: '/chat' });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-bold mb-8">
          <span className="text-accent">JeffGPT</span>
        </h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm text-muted mb-1">Email</span>
            <input
              className="w-full bg-panel border border-border px-3 py-2 rounded focus:border-accent outline-none"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="block text-sm text-muted mb-1">Password</span>
            <input
              className="w-full bg-panel border border-border px-3 py-2 rounded focus:border-accent outline-none"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-bg font-semibold py-2.5 rounded hover:bg-amber-400 transition disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/login')({ component: LoginPage });
