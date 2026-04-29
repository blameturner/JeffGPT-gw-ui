import { useEffect, type ReactNode } from 'react';

// Right-side slide-over drawer (~720px). Below 900px it becomes full-screen.
export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-label={label} aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm cursor-e-resize"
      />
      <aside className="relative ml-auto h-full w-full sm:w-[720px] sm:max-w-[92vw] bg-bg border-l border-border shadow-2xl flex flex-col">
        {children}
      </aside>
    </div>
  );
}

export function DrawerHeader({
  title,
  subtitle,
  onClose,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-border px-6 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-display text-xl tracking-tightest truncate">{title}</div>
        {subtitle && <div className="text-xs text-muted mt-0.5 truncate font-mono">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted hover:text-fg p-1 -mr-1"
            aria-label="Close drawer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function DrawerBody({ children }: { children: ReactNode }) {
  return <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">{children}</div>;
}

export function DrawerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-border px-6 py-3 flex items-center justify-between gap-3 text-xs text-muted">
      {children}
    </div>
  );
}
