import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { MemoryPage } from '../features/memory/MemoryPage';

export const Route = createFileRoute('/memory')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: MemoryPage,
});
