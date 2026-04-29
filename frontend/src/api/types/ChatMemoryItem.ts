export type ChatMemoryCategory = 'fact' | 'decision' | 'thread';
export type ChatMemoryStatus = 'proposed' | 'active' | 'rejected';

export interface ChatMemoryItem {
  Id: number;
  conversation_id: number;
  org_id: number;
  category: ChatMemoryCategory;
  text: string;
  pinned: boolean;
  status: ChatMemoryStatus;
  confidence: number;
  source_message_id?: number | null;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ChatMemoryCounts {
  fact: number;
  decision: number;
  thread: number;
  proposed: number;
  pinned: number;
}

export interface ChatMemoryListResponse {
  items: ChatMemoryItem[];
  grouped?: Record<ChatMemoryCategory, ChatMemoryItem[]>;
  counts: ChatMemoryCounts;
}

export interface ChatMemoryExtractResponse {
  persisted: number;
  delta?: ChatMemoryItem[];
}
