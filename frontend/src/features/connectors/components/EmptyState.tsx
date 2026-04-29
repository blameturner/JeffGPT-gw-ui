import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-border rounded-lg px-6 py-16 text-center max-w-xl mx-auto my-8 bg-panel">
      <div className="font-display text-xl tracking-tightest mb-2">{title}</div>
      <p className="text-sm text-muted mb-5">{body}</p>
      {cta}
    </div>
  );
}
