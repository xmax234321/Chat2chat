import { useCallback, useRef, useState } from 'react';

type Options = {
  enabled: boolean;
  onDismiss: () => void;
  blockWhen?: () => boolean;
};

export function useSwipeToDismiss({ enabled, onDismiss, blockWhen }: Options) {
  const swipeRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const [offsetY, setOffsetY] = useState(0);

  const reset = useCallback(() => {
    setOffsetY(0);
    swipeRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || blockWhen?.() || e.touches.length !== 1) return;
      swipeRef.current = {
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY,
        active: true,
      };
    },
    [blockWhen, enabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !swipeRef.current?.active || e.touches.length !== 1) return;
      const dx = e.touches[0]!.clientX - swipeRef.current.x;
      const dy = e.touches[0]!.clientY - swipeRef.current.y;
      if (Math.abs(dy) < Math.abs(dx) * 0.55) return;
      if (dy > 0) setOffsetY(dy);
    },
    [enabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled || !swipeRef.current?.active) return;
    if (offsetY > 100) onDismiss();
    reset();
  }, [enabled, offsetY, onDismiss, reset]);

  const backdropOpacity = Math.max(0.25, 1 - offsetY / 320);
  const contentScale = Math.max(0.9, 1 - offsetY / 900);

  return {
    offsetY,
    backdropOpacity,
    contentScale,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    reset,
  };
}
