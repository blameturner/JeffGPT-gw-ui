interface Props {
  title: string;
  message: string;
}

export function PlaceholderWidget({ title, message }: Props) {
  return (
    <div className="border border-dashed border-border p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</div>
      <div className="mt-1 text-[12px] text-muted">{message}</div>
    </div>
  );
}

