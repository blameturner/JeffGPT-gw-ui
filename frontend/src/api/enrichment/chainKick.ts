
export type ChainKickResponse =
  | { status: 'kicked'; queued: number }
  | { status: 'already_running'; inflight: number }
  | { status: 'disabled' }
  | { status: 'no_queue' }
  | { status: 'failed'; error?: string };
