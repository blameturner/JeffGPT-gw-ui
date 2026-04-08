import { Hono } from 'hono';
import { listAgents } from '../services/harness/endpoints.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import type { AuthVariables } from '../types/auth.js';

export const workersRoute = new Hono<{ Variables: AuthVariables }>();

workersRoute.use('*', requireAuth);

interface HarnessAgent {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  status: string | null;
}

workersRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  const response = await listAgents(orgId);
  if (!response.ok) {
    return c.json({ error: 'Failed to fetch agents from harness' }, 502);
  }
  const data = (await response.json()) as { agents: HarnessAgent[] };
  const workers = data.agents.map((r) => ({
    Id: r.Id,
    name: r.name,
    display_name: r.display_name,
    model: r.model,
  }));
  return c.json({ workers });
});