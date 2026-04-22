import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as Msg } from '../hooks/useHomeChat';

export function ChatMessage({ m }: { m: Msg }) {
  const isUser = m.role === 'user';

  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[90%] border px-3 py-2 text-[13px]',
          isUser ? 'border-fg text-fg' : 'border-border text-fg',
        ].join(' ')}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.text}</div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text || '...'}</ReactMarkdown>
          </div>
        )}
        {m.streaming && <span className="ml-1 inline-block animate-pulse text-muted">|</span>}
      </div>
    </div>
  );
}

