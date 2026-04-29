import { useEffect, useRef, useState } from 'react';

interface Props {
  attachedFiles: File[];
  attachedUrls: string[];
  onAddFiles: (files: File[]) => void;
  onAddUrl: (url: string) => void;
  onRemoveFile: (index: number) => void;
  onRemoveUrl: (index: number) => void;
  disabled?: boolean;
}

export function AttachContextMenu({
  attachedFiles,
  attachedUrls,
  onAddFiles,
  onAddUrl,
  onRemoveFile,
  onRemoveUrl,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const totalAttached = attachedFiles.length + attachedUrls.length;

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Drop in context"
        aria-label="Drop in context"
        className="relative shrink-0 w-9 h-9 rounded-md border border-border text-muted hover:border-fg hover:text-fg transition-colors flex items-center justify-center text-sm disabled:opacity-40"
      >
        📎
        {totalAttached > 0 && (
          <span className="absolute -top-1 -right-1 bg-fg text-bg rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-sans">
            {totalAttached}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-bg border border-border rounded-md shadow-card z-30 p-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-1">
              Files
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-[12px] px-2 py-1.5 rounded border border-border hover:border-fg text-fg"
            >
              Choose file…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const f = Array.from(e.target.files ?? []);
                if (f.length) onAddFiles(f);
                e.target.value = '';
              }}
            />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-1">URL</p>
            <div className="flex gap-1">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim()) {
                    e.preventDefault();
                    try {
                      // eslint-disable-next-line no-new
                      new URL(url.trim());
                      onAddUrl(url.trim());
                      setUrl('');
                    } catch {
                      // ignore invalid url
                    }
                  }
                }}
                placeholder="https://…"
                className="flex-1 bg-bg border border-border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-fg"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    new URL(url.trim());
                    onAddUrl(url.trim());
                    setUrl('');
                  } catch {
                    /* ignore */
                  }
                }}
                disabled={!url.trim()}
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 rounded border border-fg text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {totalAttached > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-1">
                Attached
              </p>
              <ul className="space-y-1">
                {attachedFiles.map((f, i) => (
                  <li
                    key={`f-${i}`}
                    className="flex items-center justify-between gap-2 text-[11px] text-fg bg-panel/50 px-2 py-1 rounded"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(i)}
                      className="text-muted hover:text-red-600 text-[10px]"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {attachedUrls.map((u, i) => (
                  <li
                    key={`u-${i}`}
                    className="flex items-center justify-between gap-2 text-[11px] text-fg bg-panel/50 px-2 py-1 rounded"
                  >
                    <span className="truncate">{u}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveUrl(i)}
                      className="text-muted hover:text-red-600 text-[10px]"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AttachmentChips({
  attachedFiles,
  attachedUrls,
  onRemoveFile,
  onRemoveUrl,
}: {
  attachedFiles: File[];
  attachedUrls: string[];
  onRemoveFile: (i: number) => void;
  onRemoveUrl: (i: number) => void;
}) {
  if (attachedFiles.length === 0 && attachedUrls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {attachedFiles.map((f, i) => (
        <span
          key={`f-${i}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-sans bg-panel border border-border rounded-full pl-2.5 pr-1 py-0.5"
        >
          📄 {f.name}
          <button
            type="button"
            onClick={() => onRemoveFile(i)}
            aria-label="Remove"
            className="w-4 h-4 rounded-full text-muted hover:text-red-600"
          >
            ×
          </button>
        </span>
      ))}
      {attachedUrls.map((u, i) => (
        <span
          key={`u-${i}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-sans bg-panel border border-border rounded-full pl-2.5 pr-1 py-0.5 max-w-[260px]"
        >
          🔗 <span className="truncate">{u}</span>
          <button
            type="button"
            onClick={() => onRemoveUrl(i)}
            aria-label="Remove"
            className="w-4 h-4 rounded-full text-muted hover:text-red-600"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
