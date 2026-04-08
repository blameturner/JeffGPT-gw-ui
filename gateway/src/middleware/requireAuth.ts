import type { Context, Next } from 'hono';
import { auth, getOrgIdForUser } from '../auth.js';
import type { Variables } from '../types.js';

export async function requireAuth(c: Context<{ Variables: Variables }>, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const orgId = (session.user as any).orgId ?? (await getOrgIdForUser(session.user.id));
  if (!orgId) {
    return c.json({ error: 'no_org' }, 403);
  }
  c.set('userId', session.user.id);
  c.set('orgId', orgId);
  c.set('email', session.user.email);
  await next();
}
