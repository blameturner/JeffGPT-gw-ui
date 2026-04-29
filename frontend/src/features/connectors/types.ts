// Types for the Connectors feature (APIs, SMTP, Secrets).

export type ApiAuthType = 'none' | 'bearer' | 'basic' | 'api_key_header' | 'api_key_query' | 'oauth2';
export type ConnectorStatus = 'verified' | 'send_only' | 'failed' | 'unverified';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiConnection {
  id: number;
  org_id: number | string;
  name: string;
  description?: string | null;
  base_url: string;
  auth_type: ApiAuthType;
  auth_secret_ref?: string | null;
  auth_extra_json?: Record<string, unknown> | null;
  default_headers_json?: Record<string, unknown> | null;
  default_query_json?: Record<string, unknown> | null;
  allowed_methods?: HttpMethod[] | null;
  allowed_paths_regex?: string | null;
  timeout_seconds?: number | null;
  rate_limit_per_min?: number | null;
  openapi_url?: string | null;
  inspection_summary_json?: InspectionSummary | null;
  usage_prompt?: string | null;
  status?: ConnectorStatus | null;
  verified_at?: string | null;
  verification_note?: string | null;
  endpoints_count?: number | null;
  used_by_agents?: AgentRef[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface InspectionSummary {
  openapi?: {
    summary?: {
      endpoints_sample?: Array<{ method: HttpMethod; path: string; summary?: string }>;
    };
  };
  probe?: Record<string, unknown>;
  errors?: Array<{ stage: string; message: string }>;
  [k: string]: unknown;
}

export interface SmtpAccount {
  id: number;
  org_id: number | string;
  name: string;
  description?: string | null;
  from_email: string;
  host: string;
  port: number;
  use_tls?: boolean;
  use_starttls?: boolean;
  username?: string | null;
  password_secret_ref?: string | null;
  imap_enabled?: boolean;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_username?: string | null;
  imap_password_secret_ref?: string | null;
  status?: ConnectorStatus | null;
  verified_at?: string | null;
  verification_status?: string | null;
  verification_note?: string | null;
  last_test_message_id?: string | null;
  used_by_agents?: AgentRef[] | null;
  created_at?: string;
  updated_at?: string;
}

export type SecretKind =
  | 'api_key'
  | 'oauth_token'
  | 'password'
  | 'webhook_secret'
  | 'private_key'
  | 'certificate'
  | 'other';

export interface Secret {
  id: number;
  org_id: number | string;
  name: string;
  kind: SecretKind;
  description?: string | null;
  // Value is always redacted in list/get; "•••" + length string returned by backend
  value_redacted?: string;
  value_length?: number;
  expires_at?: string | null;
  rotated_at?: string | null;
  used_by?: SecretReferrer[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface SecretReferrer {
  kind: 'api_connection' | 'smtp_account';
  id: number;
  name: string;
}

export interface AgentRef {
  id: number;
  name: string;
}

export interface InspectResult {
  status: ConnectorStatus;
  usage_prompt: string;
  inspection: InspectionSummary;
}

export interface TestCallResult {
  status_code: number;
  status_text?: string;
  duration_ms: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface SmtpTestResult {
  status: ConnectorStatus;
  note?: string;
  message_id?: string;
}
