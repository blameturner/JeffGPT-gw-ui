import type { ChatMessageRow } from '../lib/api';

interface Props {
  message: Pick<ChatMessageRow, 'role' | 'content'> & { id?: string | number };
  pending?: boolean;
}

export function ChatBubble({ message, pending }: Props) {
  const isUser = message.role === 'user';
  return (
    <div
      className={`flex animate-fadeIn ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={[
          'max-w-[78%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-fg text-bg rounded-br-sm font-medium'
            : 'bg-panel border border-border text-fg rounded-bl-sm',
          pending ? 'opacity-60 italic' : '',
        ].join(' ')}
      >
        {message.content || (pending ? 'Thinking…' : '')}
      </div>
    </div>
  );
}
