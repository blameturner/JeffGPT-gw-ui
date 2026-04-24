import { useCallback, useEffect, useRef, useState } from 'react';
import { getPAStatus } from '../../../api/home/pa';
import type { PAStatus } from '../../../api/home/types';

export interface PAStatusState {
  status: PAStatus | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export function usePAStatus(pollMs: number = 60_000): PAStatusState {
  const [status, setStatus] = useState<PAStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const activeRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await getPAStatus();
      if (activeRef.current) {
        setStatus(res);
        setLoaded(true);
      }
    } catch {
      // stale-while-revalidate: keep last status on transient error
      if (activeRef.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    let iv: number | null = null;

    function start() {
      if (iv != null) return;
      iv = window.setInterval(() => {
        if (document.visibilityState === 'visible') void refresh();
      }, pollMs);
    }
    function stop() {
      if (iv != null) {
        window.clearInterval(iv);
        iv = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void refresh();
        start();
      } else {
        stop();
      }
    }

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      activeRef.current = false;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, pollMs]);

  return { status, loaded, refresh };
}
