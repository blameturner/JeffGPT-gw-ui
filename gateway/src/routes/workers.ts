import { Hono } from 'hono';
import { listWhere } from '../nocodb.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const workersRoute = new Hono();

workersRoute.use('*', requireAuth);

workersRoute.get('/', async (c) => {
  const orgId = c.get('orgId' as never) as number;
  const workers = await listWhere<any>('workers', `(org_id,eq,${orgId})`, 200);
  return c.json({ workers });
});
