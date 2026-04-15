import { http } from '../../lib/http';
import type { ConversationSummary } from '../types/ConversationSummary';

export function getConversationSummary(conversationId: number) {
  return http
    .get(`conversations/${conversationId}/summary`)
    .json<ConversationSummary>();
}
