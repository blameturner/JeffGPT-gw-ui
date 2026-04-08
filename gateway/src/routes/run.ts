import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../env.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const runRoute = new Hono();

runRoute.use('*', requireAuth);

const runSchema = z.object({
  agent_name: z.string().min(1),
  task: z.string().min(1),
  product: z.string().default(''),
});

runRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const orgId = c.get('orgId' as never) as number;
  const payload = { ...parsed.data, org_id: orgId };

  const res = await fetch(`${env.HARNESS_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? 'application/json';
  return new Response(text, { status: res.status, headers: { 'Content-Type': contentType } });
});
