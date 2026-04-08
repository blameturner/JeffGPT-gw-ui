import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { chat as harnessChat } from '../services/harness/index.js';
import type { AuthVariables } from '../types/auth.js';

export const chatRoute = new Hono<{ Variables: AuthVariables }>();

chatRoute.use('*', requireAuth);

const chatSchema = z.object({
  model: z.string().min(1),
  message: z.string().min(1),
  conversation_id: z.number().int().positive().optional().nullable(),
  system: z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(32_000).optional(),
});

chatRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const { orgId } = getAuthContext(c);
  // org_id is injected from the session — the frontend never supplies it.
  const payload = { ...parsed.data, org_id: Number(orgId) };

  try {
    const res = await harnessChat(payload);
    const text = await res.text();
    if (!res.ok) {
      console.error('[chat] harness error', res.status, text);
      return c.json(
        { error: 'harness_error', status: res.status, detail: text.slice(0, 500) },
        502,
      );
    }
    const contentType = res.headers.get('content-type') ?? 'application/json';
    return new Response(text, { status: res.status, headers: { 'Content-Type': contentType } });
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[chat] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
