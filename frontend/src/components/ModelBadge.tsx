export function ModelBadge({ model }: { model?: string }) {
  if (!model) return null;
  return (
    <span className="inline-block text-[10px] uppercase tracking-wide text-muted bg-panelHi border border-border rounded px-1.5 py-0.5">
      {model}
    </span>
  );
}
