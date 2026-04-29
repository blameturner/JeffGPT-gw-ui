import type { Context } from 'hono';
import { z } from 'zod';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { assertInteger } from '../../lib/assertInteger.js';
import {
  getConversationSummary as harnessGetSummary,
  listMemoryItems as harnessList,
  createMemoryItem as harnessCreate,
  updateMemoryItem as harnessUpdate,
  deleteMemoryItem as harnessDelete,
  extractMemory as harnessExtract,
} from '../../services/harness/index.js';

async function ownsConversation(c: Context, conversationId: number, orgId: number) {
  const res = await harnessGetSummary(conversationId, orgId);
  if (!res.ok) return { ok: false as const, res };
  const json = (await res.json()) as { conversation?: { org_id?: number } | null };
  if (!json.conversation || Number(json.conversation.org_id) !== Number(orgId)) {
    return { ok: false as const, res: c.json({ error: 'not_found' }, 404) };
  }
  return { ok: true as const };
}

function getConvId(c: Context): number | Response {
  try {
    return assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
}

function getItemId(c: Context): number | Response {
  try {
    return assertInteger(c.req.param('itemId'), 'item_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
}

export async function listMemory(c: Context) {
  const { orgId } = getAuthContext(c);
  const cid = getConvId(c);
  if (typeof cid !== 'number') return cid;
  const owns = await ownsConversation(c, cid, Number(orgId));
  if (!owns.ok) return owns.res instanceof Response ? owns.res : forwardResponse(owns.res as Response);
  try {
    const res = await harnessList(cid, Number(orgId), {
      status: c.req.query('status'),
      category: c.req.query('category'),
      pinned_only: c.req.query('pinned_only') === 'true' ? true : undefined,
    });
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
}

const createSchema = z.object({
  category: z.enum(['fact', 'decision', 'thread']),
  text: z.string().min(1).max(2000),
  pinned: z.boolean().optional(),
  status: z.enum(['proposed', 'active', 'rejected']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  source_message_id: z.number().int().optional(),
});

export async function createMemory(c: Context) {
  const { orgId } = getAuthContext(c);
  const cid = getConvId(c);
  if (typeof cid !== 'number') return cid;
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  const owns = await ownsConversation(c, cid, Number(orgId));
  if (!owns.ok) return owns.res instanceof Response ? owns.res : forwardResponse(owns.res as Response);
  try {
    const res = await harnessCreate(cid, Number(orgId), parsed.data);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
}

const updateSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  category: z.enum(['fact', 'decision', 'thread']).optional(),
  pinned: z.boolean().optional(),
  status: z.enum(['proposed', 'active', 'rejected']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export async function updateMemory(c: Context) {
  const { orgId } = getAuthContext(c);
  const cid = getConvId(c);
  if (typeof cid !== 'number') return cid;
  const iid = getItemId(c);
  if (typeof iid !== 'number') return iid;
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  const owns = await ownsConversation(c, cid, Number(orgId));
  if (!owns.ok) return owns.res instanceof Response ? owns.res : forwardResponse(owns.res as Response);
  try {
    const res = await harnessUpdate(cid, Number(orgId), iid, parsed.data);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
}

export async function deleteMemory(c: Context) {
  const { orgId } = getAuthContext(c);
  const cid = getConvId(c);
  if (typeof cid !== 'number') return cid;
  const iid = getItemId(c);
  if (typeof iid !== 'number') return iid;
  const owns = await ownsConversation(c, cid, Number(orgId));
  if (!owns.ok) return owns.res instanceof Response ? owns.res : forwardResponse(owns.res as Response);
  try {
    const res = await harnessDelete(cid, Number(orgId), iid);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
}

export async function extractMemory(c: Context) {
  const { orgId } = getAuthContext(c);
  const cid = getConvId(c);
  if (typeof cid !== 'number') return cid;
  const owns = await ownsConversation(c, cid, Number(orgId));
  if (!owns.ok) return owns.res instanceof Response ? owns.res : forwardResponse(owns.res as Response);
  try {
    const res = await harnessExtract(cid, Number(orgId));
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
}
