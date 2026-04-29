import { useState } from 'react';

export function DangerZone({
  resourceLabel,
  confirmName,
  onDelete,
  busy,
  children,
}: {
  resourceLabel: string;
  confirmName: string;
  onDelete: () => Promise<void> | void;
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const [armed, setArmed] = useState(false);
  const ok = typed === confirmName;
  return (
    <section className="border border-red-200 rounded-md p-4 bg-red-50/40">
      <h3 className="font-display text-base text-red-900">Danger zone</h3>
      <p className="text-xs text-red-900/70 mt-1">
        {children ?? `Delete this ${resourceLabel}. This action cannot be undone.`}
      </p>
      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="mt-3 text-[11px] uppercase tracking-[0.18em] font-sans border border-red-700 text-red-800 px-3 py-2 hover:bg-red-700 hover:text-white transition-colors"
        >
          Delete {resourceLabel}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-red-900/80 font-sans">
            Type <span className="font-mono">{confirmName}</span> to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full border border-red-300 bg-bg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-700"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!ok || busy}
              onClick={() => onDelete()}
              className="text-[11px] uppercase tracking-[0.18em] font-sans border border-red-700 bg-red-700 text-white px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              onClick={() => {
                setArmed(false);
                setTyped('');
              }}
              className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border text-muted px-3 py-2 hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
