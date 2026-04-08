import ky from 'ky';
import { gatewayUrl } from './runtime-env';

export const http = ky.create({
  prefixUrl: gatewayUrl(),
  credentials: 'include',
  timeout: 300_000,
});

export type Confidence = 'low' | 'medium' | 'high';

export interface AgentOutput {
  title: string;
  summary: string;
  domain: string;
  key_points: string[];
  recommendations: string[];
  next_steps: string[];
  observations: string[];
  follow_up_questions: string[];
  tags: string[];
  confidence: Confidence;
}

export interface RunResponse {
  success: boolean;
  agent: string;
  org_id: number;
  product: string;
  output: AgentOutput;
}

export interface Worker {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  [k: string]: unknown;
}

export interface LlmModel {
  name: string;
  url: string;
}

export interface Conversation {
  Id: number;
  org_id: number;
  model: string;
  title: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessageRow {
  Id: number;
  conversation_id: number;
  role: ChatRole;
  content: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  CreatedAt?: string;
}

export interface ChatResponse {
  success: boolean;
  conversation_id: number;
  model: string;
  output: string;
  tokens_input: number;
  tokens_output: number;
  duration_seconds: number;
}

export interface ConversationSummary {
  conversation: Conversation;
  message_count: number;
  role_counts: Record<string, number>;
  observation_count: number;
  run_count: number;
  output_count: number;
  task_count: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  tokens_breakdown: {
    messages_input: number;
    messages_output: number;
    runs_input: number;
    runs_output: number;
    runs_context: number;
  };
  first_message_at: string | null;
  last_message_at: string | null;
  run_duration_seconds: number;
  chars_user: number;
  chars_assistant: number;
  models_used: string[];
  agents_used: string[];
  themes: string[];
  theme_counts: Record<string, number>;
  observation_types: string[];
  observation_confidences: Record<string, number>;
  observation_statuses: Record<string, number>;
  run_statuses: Record<string, number>;
  task_statuses: Record<string, number>;
  observations: Array<{
    Id: number;
    title: string;
    content: string;
    type: string;
    domain: string;
    confidence: string;
    status: string;
    source_run_id?: number;
    agent_id?: number;
    agent_name?: string;
    org_id: number;
    conversation_id: number;
    CreatedAt?: string;
  }>;
  runs: Array<{
    Id: number;
    agent_id: number;
    agent_name: string;
    agent_version?: number;
    status: string;
    summary?: string;
    tokens_input: number;
    tokens_output: number;
    context_tokens?: number;
    duration_seconds: number;
    quality_score?: number;
    model_name?: string;
    CreatedAt?: string;
  }>;
  outputs: Array<{
    Id: number;
    run_id: number;
    agent_name?: string;
    full_text: string;
    CreatedAt?: string;
  }>;
  tasks: unknown[];
}

export const api = {
  setupStatus: () => http.get('api/setup/status').json<{ configured: boolean }>(),
  setup: (body: {
    orgName: string;
    slug: string;
    email: string;
    password: string;
    displayName: string;
  }) => http.post('api/setup', { json: body }).json<{ success: boolean }>(),
  workers: () => http.get('api/workers').json<{ workers: Worker[] }>(),
  run: (body: { agent_name: string; task: string; product: string }) =>
    http.post('api/run', { json: body }).json<RunResponse>(),
  health: () => http.get('api/health').json<{ status: string; harness: string }>(),
  orgMe: () => http.get('api/org/me').json<{ org: any; user: any }>(),
  models: () => http.get('api/models').json<{ models: LlmModel[] }>(),
  conversations: () =>
    http.get('api/conversations').json<{ conversations: Conversation[] }>(),
  conversationMessages: (conversationId: number) =>
    http
      .get(`api/conversations/${conversationId}/messages`)
      .json<{ conversation: Conversation; messages: ChatMessageRow[] }>(),
  conversationSummary: (conversationId: number) =>
    http
      .get(`api/conversations/${conversationId}/summary`)
      .json<ConversationSummary>(),
  chat: (body: {
    model: string;
    message: string;
    conversation_id?: number | null;
    system?: string | null;
    temperature?: number;
    max_tokens?: number;
  }) => http.post('api/chat', { json: body }).json<ChatResponse>(),
};
