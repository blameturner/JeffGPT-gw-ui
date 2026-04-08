import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import {
  getConversationMessages as harnessGetMessages,
  getConversationSummary as harnessGetSummary,
  listConversations as harnessListConversations,
} from '../services/harness/index.js';
import { assertInteger } from '../lib/noco-filter.js';
import type { AuthVariables } from '../types/auth.js';

export const conversationsRoute = new Hono<{ Variables: AuthVariables }>();

conversationsRoute.use('*', requireAuth);

async function forward(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? 'application/json';
  return new Response(text, { status: res.status, headers: { 'Content-Type': contentType } });
}

function mapHarnessError(err: unknown) {
  if (err instanceof FetchTimeoutError) return new Response(JSON.stringify({ error: 'harness_timeout' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
  console.error('[conversations] harness unreachable', err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
}

/** List this org's conversations (most recent first). */
conversationsRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessListConversations(Number(orgId));
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

/**
 * Fetch full history for one conversation. We check that the conversation
 * belongs to the caller's org before returning — org_id is enforced server-side,
 * never trusted from the client.
 */
/**
 * Rich stats for a conversation. Same org-ownership check as /messages —
 * we fetch the conversation first (indirectly, via the summary response)
 * and reject if org_id doesn't match the caller's session.
 */
conversationsRoute.get('/:id/summary', async (c) => {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const res = await harnessGetSummary(conversationId);
    if (!res.ok) return forward(res);
    const body = (await res.json()) as {
      conversation?: { org_id?: number } | null;
    };
    if (!body.conversation || Number(body.conversation.org_id) !== Number(orgId)) {
      return c.json({ error: 'not_found' }, 404);
    }
    return c.json(body);
  } catch (err) {
    return mapHarnessError(err);
  }
});

conversationsRoute.get('/:id/messages', async (c) => {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }

  try {
    const res = await harnessGetMessages(conversationId);
    if (!res.ok) return forward(res);
    const body = (await res.json()) as {
      conversation?: { org_id?: number } | null;
      messages?: unknown[];
    };
    if (!body.conversation || Number(body.conversation.org_id) !== Number(orgId)) {
      return c.json({ error: 'not_found' }, 404);
    }
    return c.json(body);
  } catch (err) {
    return mapHarnessError(err);
  }
});
