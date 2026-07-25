import { useCallback, type RefObject } from 'react';

/** Scroll chat messages when the input is focused. */
export function useChatInputFocus(messagesRef: RefObject<HTMLElement | null>) {
  return useCallback(() => {
    const run = () => {
      const el = messagesRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    };
    run();
    requestAnimationFrame(run);
    window.setTimeout(run, 120);
    window.setTimeout(run, 320);
  }, [messagesRef]);
}
