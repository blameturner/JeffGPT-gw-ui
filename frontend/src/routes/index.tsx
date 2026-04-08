import { createFileRoute, redirect } from '@tanstack/react-router';
import { api } from '../lib/api';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      const status = await api.setupStatus();
      if (!status.configured) {
        throw redirect({ to: '/setup' });
      }
    } catch (err) {
      if ((err as any)?.routerCode) throw err;
      // Gateway unreachable — still attempt setup flow.
      throw redirect({ to: '/setup' });
    }
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
    throw redirect({ to: '/chat' });
  },
  component: () => null,
});
