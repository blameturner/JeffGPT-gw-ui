/**
 * Shared response shape for chain-kick endpoints (scraper/start, pathfinder/start).
 * Backend signals which of four terminal states it took.
 */
export type ChainKickResponse =
  | { status: 'kicked'; queued: number }
  | { status: 'already_running'; inflight: number }
  | { status: 'disabled' }
  | { status: 'no_queue' };
