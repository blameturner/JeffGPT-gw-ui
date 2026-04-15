import { http } from '../../lib/http';
import type { Conversation } from '../types/Conversation';
import type { ChatMessageRow } from '../types/ChatMessageRow';

export function getConversationMessages(conversationId: number) {
  return http
    .get(`conversations/${conversationId}/messages`)
    .json<{ conversation: Conversation; messages: ChatMessageRow[] }>();
}
