import { createFileRoute, useParams } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { SimulationDetailPage } from '../features/simulations/SimulationDetailPage';

function SimulationDetailRoute() {
  const { simId } = useParams({ from: '/simulations/$simId' });
  return <SimulationDetailPage simId={Number(simId)} />;
}

export const Route = createFileRoute('/simulations/$simId')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: SimulationDetailRoute,
});
