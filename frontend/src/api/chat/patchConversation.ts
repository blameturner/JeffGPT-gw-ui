import { http } from '../../lib/http';

export async function patchConversation(
  id: number,
  body: { title?: string; contextual_grounding_enabled?: boolean; deleted_at?: string },
): Promise<void> {
  await http.patch(`conversations/${id}`, { json: body });
}
