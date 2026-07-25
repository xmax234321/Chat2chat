import { useCallback, useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function useImageZoom(active: boolean) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef<{ dist: number; scale: number; mid: Point; offset: Point } | null>(null);
  const panRef = useRef<{ start: Point; offset: Point } | null>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      pinchRef.current = null;
      panRef.current = null;
    }
  }, [active]);

  const clampOffset = useCallback((s: number, x: number, y: number) => {
    const max = Math.max(0, (s - 1) * 140);
    return {
      x: Math.max(-max, Math.min(max, x)),
      y: Math.max(-max, Math.min(max, y)),
    };
  }, []);

  const onDoubleTap = useCallback(() => {
    setScale((prev) => {
      const next = prev > 1.05 ? 1 : 2.5;
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const a = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        const b = { x: e.touches[1]!.clientX, y: e.touches[1]!.clientY };
        pinchRef.current = {
          dist: distance(a, b),
          scale,
          mid: midpoint(a, b),
          offset: { ...offset },
        };
        panRef.current = null;
        return;
      }
      if (e.touches.length === 1 && scale > 1) {
        panRef.current = {
          start: { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY },
          offset: { ...offset },
        };
      }
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        onDoubleTap();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    },
    [offset, onDoubleTap, scale],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const a = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        const b = { x: e.touches[1]!.clientX, y: e.touches[1]!.clientY };
        const dist = distance(a, b);
        const ratio = dist / pinchRef.current.dist;
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchRef.current.scale * ratio));
        setScale(nextScale);
        if (nextScale <= 1) setOffset({ x: 0, y: 0 });
        return;
      }
      if (e.touches.length === 1 && panRef.current && scale > 1) {
        e.preventDefault();
        const dx = e.touches[0]!.clientX - panRef.current.start.x;
        const dy = e.touches[0]!.clientY - panRef.current.start.y;
        setOffset(clampOffset(scale, panRef.current.offset.x + dx, panRef.current.offset.y + dy));
      }
    },
    [clampOffset, scale],
  );

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
    setScale((s) => {
      if (s < 1) {
        setOffset({ x: 0, y: 0 });
        return 1;
      }
      return s;
    });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const style = {
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
  };

  return { style, scale, onTouchStart, onTouchMove, onTouchEnd, onWheel, resetZoom: onDoubleTap };
}
