import { useCallback, useMemo, useRef } from 'react';

type Options = {
  delay?: number;
  moveThreshold?: number;
  disabled?: boolean;
};

export function useLongPress(onLongPress: () => void, { delay = 480, moveThreshold = 12, disabled = false }: Options = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const fire = useCallback(() => {
    firedRef.current = true;
    onLongPress();
  }, [onLongPress]);

  const handlers = useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (disabled) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.pointerType !== 'mouse') {
          e.preventDefault();
        }
        firedRef.current = false;
        startRef.current = { x: e.clientX, y: e.clientY };
        timerRef.current = setTimeout(fire, delay);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!startRef.current) return;
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        if (Math.hypot(dx, dy) > moveThreshold) cancel();
      },
      onPointerUp: () => cancel(),
      onPointerLeave: () => cancel(),
      onPointerCancel: () => cancel(),
      onClick: (e: React.MouseEvent) => {
        if (!firedRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        firedRef.current = false;
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        fire();
      },
    }),
    [cancel, delay, disabled, fire, moveThreshold],
  );

  const peekLongPress = useCallback(() => {
    if (!firedRef.current) return false;
    firedRef.current = false;
    return true;
  }, []);

  return { ...handlers, peekLongPress };
}
