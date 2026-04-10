import { useEffect, useRef } from 'react';

// iOS Safari raises these when it suspends a background tab and kills in-flight fetches — treat as transient
export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  if (e.name !== 'TypeError') return false;
  const msg = (e.message ?? '').toLowerCase();
  return (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed')
  );
}

export function useWasRecentlyHidden() {
  const lastHiddenAt = useRef<number>(0);
  const lastResumedAt = useRef<number>(0);

  useEffect(() => {
    function onVis() {
      const now = Date.now();
      if (document.hidden) {
        lastHiddenAt.current = now;
      } else {
        lastResumedAt.current = now;
      }
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return {
    isHidden: () => document.hidden,
    justResumed: (ms = 1500) => Date.now() - lastResumedAt.current < ms,
    wasEverHidden: () => lastHiddenAt.current > 0,
  };
}

export function useOnVisibilityResume(onResume: () => void) {
  const cb = useRef(onResume);
  useEffect(() => {
    cb.current = onResume;
  }, [onResume]);
  useEffect(() => {
    function handler() {
      if (!document.hidden) cb.current();
    }
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
}
