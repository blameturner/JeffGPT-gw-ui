import { createFileRoute, redirect } from '@tanstack/react-router';
import { setupStatus } from '../api/auth/setupStatus';
import { authClient } from '../lib/auth-client';
import { HomePage } from '../features/home/HomePage';

export const Route = createFileRoute('/home')({
  validateSearch: (search) => ({
    tab:
      typeof search.tab === 'string' &&
      ['dashboard', 'logs', 'stats', 'queue', 'connectors'].includes(search.tab)
        ? (search.tab as 'dashboard' | 'logs' | 'stats' | 'queue' | 'connectors')
        : undefined,
  }),
  beforeLoad: async () => {
    // Only redirect to /setup on a *successful* "not configured" answer. If
    // the status endpoint errors (network, 429, 5xx) we trust the existing
    // session — bouncing a logged-in user to /setup on a transient failure
    // produces a stuck loop the user can only recover from by restarting the
    // gateway.
    try {
      const status = await setupStatus();
      if (!status.configured) {
        throw redirect({ to: '/setup' });
      }
    } catch (err) {
      if ((err as any)?.routerCode) throw err;
      console.error('[home] setup status check failed', err);
    }
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: HomePage,
});
