import { useCallback, useMemo, useRef, useState } from 'react';

type Options = {
  disabled?: boolean;
  onReply: () => void;
};

export function useSwipeToReply({ disabled = false, onReply }: Options) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState(0);

  const reset = useCallback(() => {
    startRef.current = null;
    setOffset(0);
  }, []);

  const handlers = useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (disabled) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        startRef.current = { x: e.clientX, y: e.clientY };
        setOffset(0);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!startRef.current || disabled) return;
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        if (Math.abs(dy) > Math.abs(dx) + 8) {
          reset();
          return;
        }
        if (dx > 0) setOffset(Math.min(dx, 72));
      },
      onPointerUp: () => {
        if (offset >= 56) onReply();
        reset();
      },
      onPointerLeave: () => reset(),
      onPointerCancel: () => reset(),
    }),
    [disabled, offset, onReply, reset],
  );

  return { handlers, offset };
}
