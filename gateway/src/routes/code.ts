import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { code as harnessCode } from '../services/harness/index.js';
import type { AuthVariables } from '../types/auth.js';

export const codeRoute = new Hono<{ Variables: AuthVariables }>();

codeRoute.use('*', requireAuth);

const fileSchema = z.object({
  name: z.string().min(1),
  content_b64: z.string(),
});

const codeSchema = z.object({
  model: z.string().min(1),
  message: z.string().min(1),
  mode: z.enum(['plan', 'execute', 'debug']),
  approved_plan: z.string().optional().nullable(),
  files: z.array(fileSchema).optional(),
  conversation_id: z.number().int().positive().optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
});

codeRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = codeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const { orgId } = getAuthContext(c);
  const payload = { ...parsed.data, org_id: Number(orgId) };

  try {
    const res = await harnessCode(payload);
    if (!res.ok) {
      const text = await res.text();
      console.error('[code] harness error', res.status, text);
      return c.json(
        { error: 'harness_error', status: res.status, detail: text.slice(0, 500) },
        502,
      );
    }
    const contentType = res.headers.get('content-type') ?? 'text/event-stream';
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[code] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
