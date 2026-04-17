export interface QueueActive {
  active: number;
  queued: number;
  running: number;
  conversation_id: number | null;
  source: string | null;
  org_id?: number | null;
}
