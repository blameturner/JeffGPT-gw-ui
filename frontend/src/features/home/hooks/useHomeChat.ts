import { useCallback, useEffect, useRef, useState } from 'react';
import { isRateLimited, sendHomeChat } from '../../../api/home/mutations';
import { subscribeJob, type SubscribeJobHandle } from '../../../lib/sse/subscribeJob';
import { emitToast } from '../../../lib/toast/ToastHost';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}

export function useHomeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const handles = useRef<SubscribeJobHandle[]>([]);

  const attachStream = useCallback((jobId: string) => {
    const localId = `a-${jobId}`;
    setMessages((m) => [...m, { id: localId, role: 'assistant', text: '', streaming: true }]);

    const handle = subscribeJob(jobId, (ev) => {
      if (ev.type === 'chunk') {
        setMessages((m) =>
          m.map((msg) => (msg.id === localId ? { ...msg, text: msg.text + ev.text } : msg)),
        );
        return;
      }
      if (ev.type === 'error') {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === localId
              ? { ...msg, streaming: false, text: `${msg.text}\n\n[error: ${ev.message}]` }
              : msg,
          ),
        );
        return;
      }
      if (ev.type === 'done') {
        setMessages((m) =>
          m.map((msg) => (msg.id === localId ? { ...msg, streaming: false } : msg)),
        );
      }
    });

    handles.current.push(handle);
  }, []);

  const send = useCallback(
    async (text: string, searchMode: 'disabled' | 'basic' | 'standard' = 'basic') => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setSending(true);
      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: trimmed }]);

      try {
        const { job_id } = await sendHomeChat({ message: trimmed, searchMode });
        attachStream(job_id);
      } catch (err) {
        if (isRateLimited(err)) emitToast('Rate limited - slow down', 'error');
        else emitToast(`Chat failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
      } finally {
        setSending(false);
      }
    },
    [attachStream, sending],
  );

  useEffect(
    () => () => {
      handles.current.forEach((h) => h.close());
      handles.current = [];
    },
    [],
  );

  return { messages, sending, send, attachStream };
}

