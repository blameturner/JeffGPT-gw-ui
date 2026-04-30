import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { PAPage } from '../features/pa/PAPage';

export const Route = createFileRoute('/pa')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: PAPage,
});
