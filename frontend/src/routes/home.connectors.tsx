import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { ConnectorsPage } from '../features/connectors/ConnectorsPage';

export const Route = createFileRoute('/home/connectors')({
  validateSearch: (search) => ({
    tab: typeof search.tab === 'string' ? (search.tab as 'apis' | 'smtp' | 'secrets') : undefined,
  }),
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: ConnectorsPage,
});
