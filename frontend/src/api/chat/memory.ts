import { http } from '../../lib/http';
import type {
  ChatMemoryCategory,
  ChatMemoryItem,
  ChatMemoryListResponse,
  ChatMemoryStatus,
  ChatMemoryExtractResponse,
} from '../types/ChatMemoryItem';

export interface ListMemoryQuery {
  status?: ChatMemoryStatus;
  category?: ChatMemoryCategory;
  pinned_only?: boolean;
}

export async function listMemoryItems(
  conversationId: number,
  query: ListMemoryQuery = {},
): Promise<ChatMemoryListResponse> {
  const search: Record<string, string> = {};
  if (query.status) search.status = query.status;
  if (query.category) search.category = query.category;
  if (query.pinned_only != null) search.pinned_only = String(query.pinned_only);
  return http.get(`api/conversations/${conversationId}/memory`, { searchParams: search }).json();
}

export interface CreateMemoryBody {
  category: ChatMemoryCategory;
  text: string;
  pinned?: boolean;
  status?: ChatMemoryStatus;
  confidence?: number;
  source_message_id?: number;
}

export async function createMemoryItem(
  conversationId: number,
  body: CreateMemoryBody,
): Promise<ChatMemoryItem> {
  return http.post(`api/conversations/${conversationId}/memory`, { json: body }).json();
}

export interface UpdateMemoryBody {
  text?: string;
  category?: ChatMemoryCategory;
  pinned?: boolean;
  status?: ChatMemoryStatus;
  confidence?: number;
}

export async function updateMemoryItem(
  conversationId: number,
  itemId: number,
  body: UpdateMemoryBody,
): Promise<ChatMemoryItem> {
  return http.patch(`api/conversations/${conversationId}/memory/${itemId}`, { json: body }).json();
}

export async function deleteMemoryItem(conversationId: number, itemId: number): Promise<void> {
  await http.delete(`api/conversations/${conversationId}/memory/${itemId}`);
}

export async function extractMemory(conversationId: number): Promise<ChatMemoryExtractResponse> {
  return http.post(`api/conversations/${conversationId}/memory/extract`, { json: {} }).json();
}
