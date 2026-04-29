import { useEffect, type ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: ReactNode;
  footer?: ReactNode;
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

  const w =
    size === 'sm'
      ? 'max-w-md'
      : size === 'md'
        ? 'max-w-xl'
        : size === 'lg'
          ? 'max-w-3xl'
          : 'max-w-[min(96vw,1200px)] h-[min(92vh,900px)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
      />
      <div
        className={`relative ${w} w-full bg-bg border border-border shadow-2xl flex flex-col max-h-[92vh]`}
      >
        {title && (
          <div className="shrink-0 border-b border-border px-5 py-3 flex items-center justify-between">
            <div className="font-display text-lg tracking-tightest">{title}</div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-muted hover:text-fg p-1 -mr-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
