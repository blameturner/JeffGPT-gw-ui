import type { ConversationStatus } from './ConversationStatus';
import type { SavedFragment } from './SavedFragment';

export interface Conversation {
  Id: number;
  org_id: number;
  model: string;
  title: string;
  status?: ConversationStatus;
  contextual_grounding_enabled?: boolean;
  deleted_at?: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;

  system_note?: string | null;
  default_response_style?: string | null;
  polish_pass_default?: boolean;
  strict_grounding_default?: boolean;
  ask_back_default?: boolean;
  memory_extract_every_n_turns?: number;
  memory_token_budget?: number;
  saved_fragments_json?: SavedFragment[] | null;
  rag_enabled?: boolean;
  rag_collection?: string | null;
  knowledge_enabled?: boolean;
}
