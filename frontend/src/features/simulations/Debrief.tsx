import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SimStatus } from '../../api/simulations';

interface Props {
  debrief: string | undefined;
  status: SimStatus;
}

export function Debrief({ debrief, status }: Props) {
  if (debrief && debrief.trim()) {
    return (
      <div className="h-full overflow-y-auto px-5 sm:px-8 py-6">
        <article className="max-w-3xl">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (p) => (
                <h1
                  {...p}
                  className="font-display text-2xl tracking-tightest mt-5 mb-2 first:mt-0"
                />
              ),
              h2: (p) => (
                <h2
                  {...p}
                  className="font-display text-xl tracking-tightest mt-5 mb-2 first:mt-0"
                />
              ),
              h3: (p) => (
                <h3
                  {...p}
                  className="font-display text-lg tracking-tightest mt-4 mb-1.5 first:mt-0"
                />
              ),
              p: (p) => (
                <p
                  {...p}
                  className="text-[15px] leading-relaxed my-2 first:mt-0 last:mb-0"
                />
              ),
              a: (p) => (
                <a
                  {...p}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-fg underline underline-offset-4 decoration-border hover:decoration-fg transition-colors"
                />
              ),
              strong: (p) => <strong {...p} className="font-semibold text-fg" />,
              em: (p) => <em {...p} className="italic" />,
              ul: (p) => (
                <ul
                  {...p}
                  className="list-disc pl-5 my-2 space-y-1 marker:text-muted"
                />
              ),
              ol: (p) => (
                <ol
                  {...p}
                  className="list-decimal pl-5 my-2 space-y-1 marker:text-muted"
                />
              ),
              li: (p) => <li {...p} className="text-[15px] leading-relaxed" />,
              blockquote: (p) => (
                <blockquote
                  {...p}
                  className="border-l-2 border-fg pl-4 my-3 italic text-muted"
                />
              ),
              code: (p) => (
                <code
                  {...p}
                  className="font-mono text-[13px] bg-panelHi border border-border rounded-sm px-1 py-0.5"
                />
              ),
              hr: (p) => <hr {...p} className="my-6 border-border" />,
              table: (p) => (
                <div className="my-3 overflow-x-auto">
                  <table
                    {...p}
                    className="text-sm border-collapse w-full"
                  />
                </div>
              ),
              th: (p) => (
                <th
                  {...p}
                  className="text-left font-sans uppercase text-[10px] tracking-[0.18em] text-muted border-b border-border px-2 py-1"
                />
              ),
              td: (p) => (
                <td {...p} className="border-b border-border px-2 py-1 align-top" />
              ),
            }}
          >
            {debrief}
          </ReactMarkdown>
        </article>
      </div>
    );
  }

  const message =
    status === 'failed'
      ? 'No debrief — the run failed before generating one.'
      : status === 'cancelled'
        ? 'No debrief — the run was cancelled.'
        : 'Debrief will appear when the run completes.';

  return (
    <div className="h-full overflow-y-auto px-5 sm:px-8 py-6">
      <div className="max-w-3xl space-y-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted">
          {message}
        </div>
        <div className="space-y-2 animate-pulse" aria-hidden>
          <div className="h-3 w-2/3 bg-panelHi rounded-sm" />
          <div className="h-3 w-1/2 bg-panelHi rounded-sm" />
          <div className="h-3 w-3/4 bg-panelHi rounded-sm" />
          <div className="h-3 w-1/3 bg-panelHi rounded-sm" />
        </div>
      </div>
    </div>
  );
}
