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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-8"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-3xl overflow-hidden border border-border bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</div>
          <button className="text-[11px] text-muted hover:text-fg" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(85vh - 40px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

