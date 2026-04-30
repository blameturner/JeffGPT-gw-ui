import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { GraphPage } from '../features/graph/GraphPage';

export const Route = createFileRoute('/graph')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: GraphPage,
});
