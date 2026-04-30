import { useEffect, type ReactNode } from 'react';

// Right-aligned overlay drawer. One implementation rather than five inlined
// copies — fixes inconsistent close affordances and z-index handling.
export function Drawer({
  open,
  onClose,
  width = 'max-w-md',
  title,
  eyebrow,
  meta,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: string;
  title?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex justify-end" aria-modal="true" role="dialog">
      <div
        className="absolute inset-0 bg-fg/15 backdrop-blur-[1px] animate-fadeIn"
        onClick={onClose}
      />
      <aside
        className={`relative w-full ${width} bg-bg border-l border-border h-full overflow-hidden flex flex-col shadow-card animate-fadeIn`}
      >
        <header className="shrink-0 border-b border-border px-5 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">
                {eyebrow}
              </div>
            )}
            {title && (
              <div className="font-display text-lg tracking-tightest leading-tight truncate">
                {title}
              </div>
            )}
            {meta && <div className="text-[11px] text-muted mt-0.5 truncate">{meta}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mt-0.5 -mr-1 w-7 h-7 rounded-sm text-muted hover:text-fg hover:bg-panelHi flex items-center justify-center"
          >
            <span aria-hidden className="text-base leading-none">×</span>
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-5">{children}</div>
        {actions && (
          <footer className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2">
            {actions}
          </footer>
        )}
      </aside>
    </div>
  );
}
