import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 15_000;

export const messagesRoute = new Hono<{ Variables: AuthVariables }>();

messagesRoute.use('*', requireAuth);

messagesRoute.get('/:id/search-sources', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(
      `/messages/${encodeURIComponent(id)}/search-sources`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'messages');
  }
});
