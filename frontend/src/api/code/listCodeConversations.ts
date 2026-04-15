import { http } from '../../lib/http';
import type { CodeConversation } from '../types/CodeConversation';

export function listCodeConversations() {
  return http
    .get('code/conversations')
    .json<{ conversations: CodeConversation[] }>();
}
