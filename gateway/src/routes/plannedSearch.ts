import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 30_000;
const APPROVE_TIMEOUT = 180_000;

export const plannedSearchRoute = new Hono<{ Variables: AuthVariables }>();

plannedSearchRoute.use('*', requireAuth);

plannedSearchRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(`/planned_search/${encodeURIComponent(id)}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'planned_search');
  }
});

plannedSearchRoute.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      `/planned_search/${encodeURIComponent(id)}/approve`,
      { org_id: Number(orgId) },
      APPROVE_TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'planned_search');
  }
});

plannedSearchRoute.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      `/planned_search/${encodeURIComponent(id)}/reject`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'planned_search');
  }
});

plannedSearchRoute.get('/:id/results', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/planned_search/${encodeURIComponent(id)}/results?org_id=${orgId}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'planned_search');
  }
});
