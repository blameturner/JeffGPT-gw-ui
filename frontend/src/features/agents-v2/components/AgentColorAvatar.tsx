export function AgentColorAvatar({
  name,
  colorHex,
  size = 32,
}: {
  name: string;
  colorHex?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const bg = colorHex || '#0a0a0a';
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center font-display font-semibold text-bg select-none rounded"
      style={{
        backgroundColor: bg,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
    >
      {initials || '·'}
    </span>
  );
}
