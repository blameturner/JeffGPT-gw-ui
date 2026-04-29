import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listConversations } from './listConversations.js';
import { getConversationSummary } from './getConversationSummary.js';
import { patchConversation } from './patchConversation.js';
import { getConversationMessages } from './getConversationMessages.js';
import {
  listMemory,
  createMemory,
  updateMemory,
  deleteMemory,
  extractMemory,
} from './memory.js';

export const conversationsRoute = new Hono<{ Variables: AuthVariables }>();

conversationsRoute.use('*', requireAuth);

conversationsRoute.get('/', listConversations);
conversationsRoute.get('/:id/summary', getConversationSummary);
conversationsRoute.patch('/:id', patchConversation);
conversationsRoute.get('/:id/messages', getConversationMessages);

conversationsRoute.get('/:id/memory', listMemory);
conversationsRoute.post('/:id/memory', createMemory);
conversationsRoute.patch('/:id/memory/:itemId', updateMemory);
conversationsRoute.delete('/:id/memory/:itemId', deleteMemory);
conversationsRoute.post('/:id/memory/extract', extractMemory);
