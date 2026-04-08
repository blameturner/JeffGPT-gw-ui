import type { AgentOutput, Confidence } from '../lib/api';

export type Message =
  | { role: 'user'; text: string; id: string }
  | { role: 'agent'; output: AgentOutput; id: string }
  | { role: 'pending'; id: string };

const confidenceColor: Record<Confidence, string> = {
  high: 'bg-emerald-500/15 text-emerald-400 border-emerald-600/40',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-600/40',
  low: 'bg-red-500/15 text-red-400 border-red-600/40',
};

export function ChatMessage({
  message,
  onFollowUp,
}: {
  message: Message;
  onFollowUp: (q: string) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-fadeIn">
        <div className="max-w-[70%] bg-accent text-bg px-4 py-2 rounded-lg rounded-br-sm font-medium">
          {message.text}
        </div>
      </div>
    );
  }
  if (message.role === 'pending') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="text-muted text-sm px-4 py-2">Thinking…</div>
      </div>
    );
  }
  const o = message.output;
  return (
    <div className="flex justify-start animate-fadeIn">
      <div className="max-w-[85%] bg-panel border border-border rounded-lg p-5 space-y-4">
        <header className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-semibold leading-tight">{o.title}</h2>
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${confidenceColor[o.confidence] ?? confidenceColor.medium}`}
          >
            {o.confidence}
          </span>
        </header>

        {o.summary && <p className="text-text/90 leading-relaxed">{o.summary}</p>}

        <Section title="Key points" items={o.key_points} />
        <Section title="Recommendations" items={o.recommendations} tone="accent" />
        <Section title="Next steps" items={o.next_steps} />
        <Section title="Observations" items={o.observations} muted />

        {o.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {o.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-0.5 rounded-full bg-panelHi border border-border text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {o.follow_up_questions?.length > 0 && (
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs uppercase tracking-wider text-muted mb-2">Follow up</p>
            <div className="flex flex-wrap gap-2">
              {o.follow_up_questions.map((q) => (
                <button
                  key={q}
                  onClick={() => onFollowUp(q)}
                  className="text-sm text-left px-3 py-1.5 rounded-full bg-panelHi border border-border hover:border-accent transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
  muted,
}: {
  title: string;
  items?: string[];
  tone?: 'accent';
  muted?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex gap-2 text-sm leading-relaxed ${
              muted ? 'text-muted' : tone === 'accent' ? 'text-accent' : 'text-text/90'
            }`}
          >
            <span className="text-muted select-none">›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
