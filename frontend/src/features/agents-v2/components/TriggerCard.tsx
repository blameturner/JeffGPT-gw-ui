import type { ReactNode } from 'react';
import { Toggle } from '../../connectors/components/Field';

export function TriggerCard({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <section className="border border-border bg-panel">
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border">
        <div>
          <h3 className="font-display text-sm tracking-tightest uppercase">{title}</h3>
          {description && (
            <p className="text-[11px] text-muted mt-0.5">{description}</p>
          )}
        </div>
        <Toggle checked={enabled} onChange={onToggle} label={`Enable ${title}`} />
      </header>
      {enabled && <div className="p-4 space-y-3">{children}</div>}
    </section>
  );
}
