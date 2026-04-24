import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalShell({ title, onClose, children }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] sm:max-h-[85vh] w-full max-w-3xl overflow-hidden border border-border bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted truncate pr-3">
            {title}
          </div>
          <button
            className="shrink-0 text-[12px] uppercase tracking-[0.14em] text-muted hover:text-fg px-2 py-1 -mr-2"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5"
          style={{ maxHeight: 'calc(92vh - 46px)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

