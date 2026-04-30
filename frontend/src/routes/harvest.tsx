import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { HarvestPage } from '../features/harvest/HarvestPage';

export const Route = createFileRoute('/harvest')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: HarvestPage,
});
