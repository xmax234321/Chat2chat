import { useCallback, useRef, useState } from 'react';

type Options = {
  enabled: boolean;
  onClose: () => void;
  edgeWidth?: number;
  blockWhen?: () => boolean;
};

export function useSwipeToClose({ enabled, onClose, edgeWidth = 24, blockWhen }: Options) {
  const swipeRef = useRef<{ x: number; y: number; fromEdge: boolean; active: boolean } | null>(null);
  const offsetXRef = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    offsetXRef.current = 0;
    setOffsetX(0);
    setDragging(false);
    swipeRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || blockWhen?.() || e.touches.length !== 1) return;
      const x = e.touches[0]!.clientX;
      const y = e.touches[0]!.clientY;
      const fromEdge = x <= edgeWidth;
      if (!fromEdge) return;
      swipeRef.current = { x, y, fromEdge, active: true };
      setDragging(true);
    },
    [blockWhen, edgeWidth, enabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !swipeRef.current?.active || e.touches.length !== 1) return;
      const dx = e.touches[0]!.clientX - swipeRef.current.x;
      const dy = e.touches[0]!.clientY - swipeRef.current.y;
      if (dx <= 0) {
        offsetXRef.current = 0;
        setOffsetX(0);
        return;
      }
      if (Math.abs(dx) < Math.abs(dy) * 0.65) return;
      const next = Math.min(dx, window.innerWidth * 0.92);
      offsetXRef.current = next;
      setOffsetX(next);
    },
    [enabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled || !swipeRef.current?.active) return;
    if (offsetXRef.current > 72) onClose();
    reset();
  }, [enabled, onClose, reset]);

  const style: React.CSSProperties = dragging
    ? {
        transform: `translateX(${offsetX}px)`,
        transition: 'none',
      }
    : {
        transform: 'translateX(0)',
        transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      };

  return {
    offsetX,
    dragging,
    style,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
