import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoScrollOptions {
  deps: unknown[];
  threshold?: number;
}

export function useAutoScroll({ deps, threshold = 50 }: UseAutoScrollOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      isAtBottomRef.current = atBottom;
      setShowScrollButton(!atBottom);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [threshold]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      containerRef.current?.scrollTo?.({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth' as ScrollBehavior,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo?.({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth' as ScrollBehavior,
    });
    isAtBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  return { containerRef, showScrollButton, scrollToBottom };
}
