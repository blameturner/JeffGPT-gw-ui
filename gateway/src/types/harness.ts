export interface HarnessRunRequest {
  agent_name: string;
  task: string;
  product: string;
  org_id: number;
}

export interface HarnessChatRequest {
  org_id: number;
  model: string;
  message: string;
  conversation_id?: number | null;
  system?: string | null;
  temperature?: number;
  max_tokens?: number;
}
