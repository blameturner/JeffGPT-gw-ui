import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 15_000;

export const collectionsRoute = new Hono<{ Variables: AuthVariables }>();

collectionsRoute.use('*', requireAuth);

collectionsRoute.get('/', async (_c) => {
  try {
    const res = await harnessClient.get('/collections', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'collections');
  }
});
