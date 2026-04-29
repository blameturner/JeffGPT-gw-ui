// Types for the agents-v2 feature. NocoDB exposes primary keys as `Id`
// (capitalised) — we mirror that here to match raw payloads.

export type AgentType = 'document' | 'queue' | 'producer' | 'responder' | 'supervisor';
export type AgentStatusKind = 'active' | 'paused' | 'failing' | 'circuit_broken' | 'inactive';
export type OnErrorAction = 'retry' | 'escalate' | 'pause' | 'fallback';
export type EditMode = 'replace' | 'append' | 'patch_section';
export type InboxKind = 'email' | 'api' | 'conversation';
export type ReplyMode = 'auto' | 'approval' | 'none';
export type OutputFormat = 'markdown' | 'json' | 'html' | 'plain';

export interface Agent {
  Id: number;
  org_id?: number | string;

  // Identity
  name: string;
  display_name?: string | null;
  description?: string | null;
  type: AgentType;
  avatar_url?: string | null;
  color_hex?: string | null;
  tags?: string[] | null;

  // Persona & prompt
  system_prompt_template?: string | null;
  persona?: string | null;
  pinned_context?: string | null;
  prompt_variables_json?: Record<string, unknown> | null;
  output_format?: OutputFormat | null;
  output_schema_json?: Record<string, unknown> | null;
  prompt_version?: number | null;

  // Brief
  brief?: string | null;

  // Model
  model?: string | null;
  fallback_model?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;

  // Memory / RAG
  rag_enabled?: boolean;
  rag_collection?: string | null;
  rag_n_candidates?: number | null;
  rag_top_k?: number | null;
  rag_scope_filter_json?: Record<string, unknown> | null;

  // Triggers
  cron_expression?: string | null;
  trigger_timezone?: string | null;
  run_window?: string | null;
  pause_until?: string | null;
  trigger_interval_minutes?: number | null;
  trigger_email_address?: string | null;
  trigger_api_slug?: string | null;
  trigger_webhook_secret?: string | null;
  trigger_supervisor?: boolean;
  trigger_table_watch_json?: { table?: string; filter?: string; on?: 'insert' | 'update' } | null;
  trigger_on_completion_of?: number[] | null;

  // Tools / APIs
  allowed_tools?: string[] | null;
  tool_config_json?: Record<string, unknown> | null;
  connected_apis?: number[] | null;
  connected_smtp?: number[] | null;
  connected_secrets?: string[] | null;
  allowed_tables_read?: string[] | null;
  allowed_tables_write?: string[] | null;
  forbidden_tables?: string[] | null;
  allowed_outbound_hosts_regex?: string | null;

  // Output / Artifact (type-specific subset; renderer reads what's relevant)
  target_table?: string | null;
  target_row_id?: number | null;
  target_column?: string | null;
  edit_mode?: EditMode | null;
  filter?: string | null;
  output_column?: string | null;
  done_column?: string | null;
  batch_size?: number | null;
  column_map?: Array<{ column: string; value: string }> | null;
  inbox_kind?: InboxKind | null;
  reply_mode?: ReplyMode | null;
  log_table?: string | null;
  team_agent_ids?: number[] | null;
  escalate_to_user_id?: number | string | null;

  // Common output
  reflect?: boolean;
  confidence_threshold?: number | null;
  max_validation_retries?: number | null;
  surface_kind?: string | null;

  // Safety / limits
  max_iterations?: number | null;
  max_runtime_seconds?: number | null;
  max_tokens_per_run?: number | null;
  max_runs_per_day?: number | null;
  max_tokens_per_day?: number | null;
  max_cost_usd_per_day?: number | null;
  max_concurrent_runs?: number | null;
  heartbeat_ttl_seconds?: number | null;
  requires_approval_for?: string[] | null;
  approval_route?: { kind: 'user' | 'agent'; target?: number | string } | null;
  dry_run?: boolean;
  test_mode?: boolean;
  on_error_action?: OnErrorAction | null;
  circuit_breaker_threshold?: number | null;
  fallback_agent_id?: number | null;
  memoize_ttl_seconds?: number | null;
  tool_cache_ttl_seconds?: number | null;
  pre_run_hook?: string | null;
  post_run_hook?: string | null;
  notify_on_complete_json?: Array<{ channel: string; target: string }> | null;
  notify_on_error_json?: Array<{ channel: string; target: string }> | null;

  // Live counters
  active?: boolean;
  consecutive_failures?: number | null;
  runs_today?: number | null;
  tokens_today?: number | null;
  cost_usd_today?: number | null;
  last_run_at?: string | null;
  last_run_status?: string | null;
  next_run_at?: string | null;
  pending_assignments_count?: number | null;
  pending_approvals_count?: number | null;
  active_workers_count?: number | null;
  avg_duration_seconds?: number | null;

  // Audit
  created_at?: string;
  updated_at?: string;

  [k: string]: unknown;
}

// Lean list-row used by the sidebar virtualized list. Backend may return a
// richer record — we only require these fields.
export interface AgentListRow {
  Id: number;
  name: string;
  display_name?: string | null;
  type: AgentType;
  brief?: string | null;
  color_hex?: string | null;
  active?: boolean;
  consecutive_failures?: number | null;
  last_run_at?: string | null;
  has_cron?: boolean;
  has_email?: boolean;
  has_api_trigger?: boolean;
  has_webhook?: boolean;
  tags?: string[] | null;
  status?: AgentStatusKind | null;
}

export interface AgentRunSummary {
  Id: number;
  agent_id: number;
  assignment_id?: number | null;
  status: 'queued' | 'running' | 'ok' | 'error' | 'aborted';
  started_at?: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  iterations?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  cost_usd?: number | null;
  error?: string | null;
}

export interface AgentRunDetail extends AgentRunSummary {
  prompt_snapshot?: string | null;
  events_jsonl?: AgentRunEvent[];
}

export type AgentRunEventKind =
  | 'run_start'
  | 'run_done'
  | 'llm_call'
  | 'tool_ok'
  | 'tool_err'
  | 'artifact_write'
  | 'approval_queued'
  | 'note';

export interface AgentRunEvent {
  ts: string;
  kind: AgentRunEventKind;
  detail?: Record<string, unknown>;
  message?: string;
}

export interface Assignment {
  Id: number;
  agent_id: number;
  agent_name?: string;
  task: string;
  source: 'cron' | 'manual' | 'email' | 'webhook' | 'api' | 'completion' | 'table_watch' | 'supervisor' | string;
  source_meta_json?: Record<string, unknown> | null;
  status: 'queued' | 'claimed' | 'running' | 'awaiting_approval' | 'done' | 'failed' | 'cancelled';
  priority?: number | null;
  attempts?: number | null;
  dedup_key?: string | null;
  created_at?: string;
  claimed_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
  result_summary?: string | null;
  result_ref_json?: Record<string, unknown> | null;
  error?: string | null;
}

export interface AgentApproval {
  Id: number;
  agent_id: number;
  agent_name?: string;
  assignment_id: number;
  action_kind: string;
  action_payload_json: Record<string, unknown>;
  created_at?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ArtifactVersion {
  Id: number;
  agent_id: number;
  assignment_id?: number | null;
  table: string;
  row_id: number | string;
  column: string;
  before_text?: string | null;
  after_text?: string | null;
  before_bytes?: number | null;
  after_bytes?: number | null;
  created_at?: string;
}

export interface AgentIncident {
  Id: number;
  agent_id: number;
  agent_name?: string;
  kind: string;
  reason: string;
  resolved?: boolean;
  resolved_note?: string | null;
  created_at?: string;
  resolved_at?: string | null;
}

export interface AgentTemplate {
  Id: number;
  name: string;
  description?: string | null;
  type: AgentType;
  defaults_json: Partial<Agent>;
  tools_preview?: string[] | null;
  apis_preview?: string[] | null;
}

export interface ToolCatalogEntry {
  name: string;
  category: 'web' | 'storage' | 'comms' | 'code' | 'data' | 'custom';
  description: string;
  config_schema?: Record<string, unknown> | null;
}

export interface NocoTable {
  name: string;
  columns: NocoColumn[];
}
export interface NocoColumn {
  name: string;
  type: string;
}

// Test-prompt result (does not persist)
export interface TestPromptResult {
  prompt_snapshot: string;
  output: string;
  output_diff?: { before: string; after: string } | null;
  tokens_in?: number;
  tokens_out?: number;
  duration_ms?: number;
}

// Run-now request
export interface RunNowBody {
  task?: string;
  priority?: number;
  dedup_key?: string;
}
