import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { OpsPage } from '../features/ops/OpsPage';

export const Route = createFileRoute('/ops')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: OpsPage,
});
