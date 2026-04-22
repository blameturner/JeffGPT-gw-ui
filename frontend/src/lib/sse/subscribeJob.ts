// frontend/src/lib/sse/subscribeJob.ts
import { gatewayUrl } from '../runtime-env';

export type SseEvent =
  | { type: 'status'; message?: string }
  | { type: 'chunk'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' }
  | { type: 'raw'; data: unknown };

export interface SubscribeJobHandle {
  close(): void;
}

export function subscribeJob(
  jobId: string,
  onEvent: (ev: SseEvent) => void,
): SubscribeJobHandle {
  let cursor = 0;
  let closed = false;
  let es: EventSource | null = null;

  function open() {
    if (closed) return;
    const url = `${gatewayUrl()}/api/stream/${encodeURIComponent(jobId)}?cursor=${cursor}`;
    es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        onEvent({ type: 'done' });
        cleanup();
        return;
      }
      if (e.lastEventId) {
        const n = parseInt(e.lastEventId, 10);
        if (Number.isFinite(n)) cursor = n + 1;
      }
      try {
        const parsed = JSON.parse(e.data);
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
          onEvent(parsed as SseEvent);
        } else {
          onEvent({ type: 'raw', data: parsed });
        }
      } catch {
        /* ignore malformed frame */
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; close on hard failure after repeated errors
      if (es && es.readyState === EventSource.CLOSED) {
        onEvent({ type: 'error', message: 'SSE connection closed' });
        cleanup();
      }
    };
  }

  function cleanup() {
    closed = true;
    if (es) {
      es.close();
      es = null;
    }
  }

  open();
  return { close: cleanup };
}
