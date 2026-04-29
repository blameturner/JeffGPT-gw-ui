import type { SavedFragment } from './SavedFragment';

export interface ConversationProperties {
  title?: string;
  contextual_grounding_enabled?: boolean;
  system_note?: string | null;
  default_response_style?: string | null;
  polish_pass_default?: boolean;
  strict_grounding_default?: boolean;
  ask_back_default?: boolean;
  memory_extract_every_n_turns?: number;
  memory_token_budget?: number;
  saved_fragments_json?: SavedFragment[];
  rag_enabled?: boolean;
  rag_collection?: string | null;
  knowledge_enabled?: boolean;
  model?: string;
}
