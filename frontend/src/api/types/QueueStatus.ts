export type BackoffState = 'active' | 'priority_1_only' | 'priority_1_2_only' | 'clear';

export interface QueueStatus {
  counts: Record<string, { queued: number; running: number; completed: number }>;
  workers: Record<string, number>;
  backoff: {
    state: BackoffState;
    idle_seconds: number;
    thresholds: {
      priority_1: number;
      priority_2: number;
      background: number;
    };
  };
  huey?: {
    enabled?: boolean;
    consumer_running?: boolean;
    workers?: number;
    sqlite_path?: string;
    queue_ready?: boolean;
  };
}
