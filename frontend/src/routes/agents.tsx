import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { AgentsPage } from '../features/agents-v2/AgentsPage';

export const Route = createFileRoute('/agents')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: AgentsPage,
});
