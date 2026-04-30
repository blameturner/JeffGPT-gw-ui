import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { SimulationsPage } from '../features/simulations/SimulationsPage';

export const Route = createFileRoute('/simulations')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: SimulationsPage,
});
