import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessageRow } from '../lib/api';

interface Props {
  message: Pick<ChatMessageRow, 'role' | 'content'> & { id?: string | number };
  pending?: boolean;
}

/**
 * Assistant messages render as Markdown (GFM — tables, task lists, strikethrough).
 * User messages are plain text preserving newlines, because we don't want to
 * re-interpret what the operator typed. Pending state shows an italic hint.
 */
export function ChatBubble({ message, pending }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-fadeIn">
        <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm text-[15px] leading-relaxed whitespace-pre-wrap bg-fg text-bg font-medium">
          {message.content}
        </div>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed bg-panel border border-border text-muted italic">
          Thinking<span className="caret" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fadeIn">
      <div className="max-w-[85%] px-5 py-4 rounded-2xl rounded-bl-sm bg-panel border border-border text-fg markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: (props) => (
              <h1
                {...props}
                className="font-display text-2xl font-semibold tracking-tightest mt-4 mb-2 first:mt-0"
              />
            ),
            h2: (props) => (
              <h2
                {...props}
                className="font-display text-xl font-semibold tracking-tightest mt-4 mb-2 first:mt-0"
              />
            ),
            h3: (props) => (
              <h3
                {...props}
                className="font-display text-lg font-semibold tracking-tightest mt-3 mb-1.5 first:mt-0"
              />
            ),
            h4: (props) => (
              <h4 {...props} className="font-sans text-[13px] uppercase tracking-[0.14em] text-muted mt-3 mb-1 first:mt-0" />
            ),
            p: (props) => (
              <p {...props} className="text-[15px] leading-relaxed my-2 first:mt-0 last:mb-0" />
            ),
            a: (props) => (
              <a
                {...props}
                target="_blank"
                rel="noreferrer noopener"
                className="text-fg underline underline-offset-4 decoration-border hover:decoration-fg transition-colors"
              />
            ),
            strong: (props) => <strong {...props} className="font-semibold text-fg" />,
            em: (props) => <em {...props} className="italic" />,
            del: (props) => <del {...props} className="text-muted" />,
            ul: (props) => (
              <ul {...props} className="list-disc pl-5 my-2 space-y-1 marker:text-muted" />
            ),
            ol: (props) => (
              <ol {...props} className="list-decimal pl-5 my-2 space-y-1 marker:text-muted" />
            ),
            li: (props) => <li {...props} className="text-[15px] leading-relaxed" />,
            blockquote: (props) => (
              <blockquote
                {...props}
                className="border-l-2 border-fg pl-4 my-3 italic text-muted"
              />
            ),
            hr: (props) => <hr {...props} className="border-border my-4" />,
            table: (props) => (
              <div className="my-3 overflow-x-auto">
                <table {...props} className="w-full text-[13px] border-collapse" />
              </div>
            ),
            thead: (props) => <thead {...props} className="border-b-2 border-fg" />,
            th: (props) => (
              <th
                {...props}
                className="text-left font-semibold font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 text-fg"
              />
            ),
            td: (props) => (
              <td {...props} className="px-3 py-1.5 border-b border-border align-top" />
            ),
            code: ({ className, children, ...rest }) => {
              // Inline code vs fenced block. react-markdown passes language via className="language-x"
              const isBlock = /language-/.test(className ?? '');
              if (isBlock) {
                return (
                  <code {...rest} className={`${className ?? ''} block`}>
                    {children}
                  </code>
                );
              }
              return (
                <code
                  {...rest}
                  className="font-mono text-[13px] bg-panelHi border border-border rounded px-1 py-0.5"
                >
                  {children}
                </code>
              );
            },
            pre: (props) => (
              <pre
                {...props}
                className="font-mono text-[12.5px] leading-relaxed bg-panelHi border border-border rounded-md p-3 my-3 overflow-x-auto whitespace-pre"
              />
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
