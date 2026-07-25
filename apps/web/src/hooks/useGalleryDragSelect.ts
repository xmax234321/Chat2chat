import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

type DragState = {
  active: boolean;
  selecting: boolean;
  visited: Set<string>;
  startX: number;
  startY: number;
  startKey: string | null;
};

type Options = {
  enabled: boolean;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
};

export function useGalleryDragSelect({ enabled, selected, setSelected }: Options) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const consumedTapRef = useRef(false);
  const autoScrollRafRef = useRef<number | null>(null);
  const lastTouchYRef = useRef(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const findCellKey = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-gallery-key]');
    return el?.getAttribute('data-gallery-key') ?? null;
  }, []);

  const applyKey = useCallback(
    (key: string, selecting: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (selecting) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [setSelected],
  );

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const visitCell = useCallback(
    (key: string) => {
      const drag = dragRef.current;
      if (!drag?.active || drag.visited.has(key)) return;
      drag.visited.add(key);
      applyKey(key, drag.selecting);
    },
    [applyKey],
  );

  const consumeTapIfDragged = useCallback(() => {
    if (!consumedTapRef.current) return false;
    consumedTapRef.current = false;
    return true;
  }, []);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !enabled) return;

    const runAutoScroll = () => {
      stopAutoScroll();
      const tick = () => {
        const drag = dragRef.current;
        if (!drag?.active || !scroll) {
          autoScrollRafRef.current = null;
          return;
        }
        const y = lastTouchYRef.current;
        const rect = scroll.getBoundingClientRect();
        const edge = 56;
        if (y < rect.top + edge) scroll.scrollTop -= 14;
        else if (y > rect.bottom - edge) scroll.scrollTop += 14;
        autoScrollRafRef.current = requestAnimationFrame(tick);
      };
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      lastTouchYRef.current = touch.clientY;
      dragRef.current = {
        active: false,
        selecting: true,
        visited: new Set(),
        startX: touch.clientX,
        startY: touch.clientY,
        startKey: findCellKey(touch.clientX, touch.clientY),
      };
      consumedTapRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      lastTouchYRef.current = touch.clientY;

      const dx = touch.clientX - drag.startX;
      const dy = touch.clientY - drag.startY;
      const distance = Math.hypot(dx, dy);
      const key = findCellKey(touch.clientX, touch.clientY);

      if (!drag.active) {
        if (distance < 10) return;
        const crossedCell = Boolean(drag.startKey && key && key !== drag.startKey);
        const horizontalIntent = Math.abs(dx) > Math.abs(dy) * 0.85 && Math.abs(dx) > 12;
        const verticalScroll = Math.abs(dy) > Math.abs(dx) * 1.35 && distance > 16 && !crossedCell;
        if (verticalScroll) {
          dragRef.current = null;
          return;
        }
        if (!crossedCell && !horizontalIntent) return;
        if (!key) return;

        drag.active = true;
        const anchorKey = drag.startKey ?? key;
        drag.selecting = !selectedRef.current.has(anchorKey);
        visitCell(anchorKey);
        if (key !== anchorKey) visitCell(key);
        consumedTapRef.current = true;
        runAutoScroll();
      }

      if (!drag.active) return;
      e.preventDefault();
      if (key) visitCell(key);
    };

    const onTouchEnd = () => {
      dragRef.current = null;
      stopAutoScroll();
    };

    scroll.addEventListener('touchstart', onTouchStart, { passive: true });
    scroll.addEventListener('touchmove', onTouchMove, { passive: false });
    scroll.addEventListener('touchend', onTouchEnd, { passive: true });
    scroll.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      scroll.removeEventListener('touchstart', onTouchStart);
      scroll.removeEventListener('touchmove', onTouchMove);
      scroll.removeEventListener('touchend', onTouchEnd);
      scroll.removeEventListener('touchcancel', onTouchEnd);
      stopAutoScroll();
    };
  }, [enabled, findCellKey, stopAutoScroll, visitCell]);

  return { scrollRef, consumeTapIfDragged };
}
