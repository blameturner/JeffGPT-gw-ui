import { useEffect } from 'react';

interface Handlers {
  onSlash?: () => void;
  onB?: () => void;
  onD?: () => void;
}

export function useKeyboardShortcuts(h: Handlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inEditable =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (inEditable || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/' && h.onSlash) {
        e.preventDefault();
        h.onSlash();
      } else if (e.key.toLowerCase() === 'b' && h.onB) {
        e.preventDefault();
        h.onB();
      } else if (e.key.toLowerCase() === 'd' && h.onD) {
        e.preventDefault();
        h.onD();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [h.onSlash, h.onB, h.onD]);
}

