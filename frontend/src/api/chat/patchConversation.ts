import { http } from '../../lib/http';
import type { ConversationProperties } from '../types/ConversationProperties';

export interface PatchConversationBody extends ConversationProperties {
  deleted_at?: string;
}

export async function patchConversation(
  id: number,
  body: PatchConversationBody,
): Promise<void> {
  await http.patch(`api/conversations/${id}`, { json: body });
}
