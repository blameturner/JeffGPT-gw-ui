import { createFileRoute, redirect } from '@tanstack/react-router';
import { setupStatus } from '../api/auth/setupStatus';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // See note in routes/home.tsx — only redirect on a successful
    // "not configured" answer; treat errors as "trust the session".
    try {
      const status = await setupStatus();
      if (!status.configured) {
        throw redirect({ to: '/setup' });
      }
    } catch (err) {
      if ((err as any)?.routerCode) throw err;
      console.error('[index] setup status check failed', err);
    }
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
    throw redirect({ to: '/home', search: { tab: undefined } });
  },
  component: () => null,
});
