import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 15_000;

export const schedulerRoute = new Hono<{ Variables: AuthVariables }>();

schedulerRoute.use('*', requireAuth);

schedulerRoute.post('/reload', async (_c) => {
  try {
    const res = await harnessClient.post('/scheduler/reload', {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'scheduler');
  }
});

schedulerRoute.get('/status', async (_c) => {
  try {
    const res = await harnessClient.get('/scheduler/status', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'scheduler');
  }
});
