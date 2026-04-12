import { useCallback, useEffect, useRef, useState } from 'react';

// treat "near the bottom" as the same as "at the bottom" so tiny drift doesn't
// hide the pill during streaming
const NEAR_BOTTOM_PX = 60;

export function useAutoScrollToBottom<T>(dep: T) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // track whether the user is parked at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
      const atBottom = distance <= NEAR_BOTTOM_PX;
      atBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, []);

  // only auto-scroll when the user was already near the bottom; otherwise
  // leave them where they are and let the scroll-to-latest pill take over
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(true);
  }, [dep, scrollToBottom]);

  return { scrollRef, isAtBottom, scrollToBottom };
}
