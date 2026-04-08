import { Hono } from 'hono';
import { listWhere } from '../nocodb.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const orgRoute = new Hono();

orgRoute.use('*', requireAuth);

orgRoute.get('/me', async (c) => {
  const orgId = c.get('orgId' as never) as number;
  const email = c.get('email' as never) as string;
  const orgs = await listWhere<any>('organisations', `(Id,eq,${orgId})`, 1);
  const users = await listWhere<any>('users', `(email,eq,${email})`, 1);
  return c.json({ org: orgs[0] ?? null, user: users[0] ?? null });
});
