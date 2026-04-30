import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { LivePage } from '../features/live/LivePage';

export const Route = createFileRoute('/live')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: LivePage,
});
