import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../auth.js';
import { countActive, createRow } from '../nocodb.js';

export const setupRoute = new Hono();

setupRoute.get('/status', async (c) => {
  try {
    const count = await countActive('organisations');
    return c.json({ configured: count > 0 });
  } catch (err) {
    console.error('[setup/status]', err);
    return c.json({ configured: false, error: 'nocodb_unreachable' }, 500);
  }
});

const setupSchema = z.object({
  orgName: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

setupRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const existing = await countActive('organisations');
  if (existing > 0) return c.json({ error: 'already_configured' }, 409);

  const { orgName, slug, email, password, displayName } = parsed.data;

  // 1. Create the org. If this fails we abort cleanly — nothing else has happened yet.
  let org: { Id: number };
  try {
    org = await createRow<{ Id: number }>('organisations', {
      name: orgName,
      slug,
      plan: 'solo',
      settings: {},
    });
  } catch (err) {
    console.error('[setup] create org failed', err);
    return c.json({ error: 'create_org_failed' }, 500);
  }

  // 2. Create the owner user row in Nocodb.
  try {
    await createRow('users', {
      org_id: org.Id,
      email,
      display_name: displayName,
      role: 'owner',
      last_active_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[setup] create user failed', err);
    return c.json({ error: 'create_user_failed', org_id: org.Id }, 500);
  }

  // 3. Create the Better-Auth account. The user.create.after hook will call
  // attachToExistingOrg, which is idempotent (it sees the users row we just made).
  try {
    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: displayName },
      headers: c.req.raw.headers,
    });
    return c.json({ success: true, user: signUp.user?.id ?? null });
  } catch (err) {
    console.error('[setup] better-auth signup failed', err);
    return c.json({ error: 'auth_signup_failed' }, 500);
  }
});