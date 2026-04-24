import { useCallback, useEffect, useRef, useState } from 'react';
import { getConversationMessages } from '../../../api/chat/getConversationMessages';
import { isRateLimited, sendHomeChat } from '../../../api/home/mutations';
import { subscribeJob, type SubscribeJobHandle } from '../../../lib/sse/subscribeJob';
import { emitToast } from '../../../lib/toast/ToastHost';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  model?: string | null;
}

export function useHomeChat(conversationId?: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const handles = useRef<SubscribeJobHandle[]>([]);

  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

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

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    getConversationMessages(conversationId)
      .then((res) => {
        if (!active) return;
        const seeded: ChatMessage[] = (res.messages ?? [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: `h-${m.Id}`,
            role: m.role as 'user' | 'assistant',
            text: m.content || '',
            streaming: false,
            model: m.model ?? null,
          }));
        setMessages((prev) => {
          // Preserve any in-flight streamed messages that haven't been persisted yet.
          const seededIds = new Set(seeded.map((s) => s.id));
          const live = prev.filter(
            (p) => p.streaming || (!p.id.startsWith('h-') && !seededIds.has(p.id)),
          );
          return [...seeded, ...live];
        });
      })
      .catch(() => {
        if (active) setMessages((prev) => prev.filter((p) => p.streaming));
      });
    return () => {
      active = false;
    };
  }, [conversationId, reloadTick]);

  useEffect(
    () => () => {
      handles.current.forEach((h) => h.close());
      handles.current = [];
    },
    [],
  );

  return { messages, sending, send, attachStream, refresh };
}


