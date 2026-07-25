import { useEffect, useRef, useState } from 'react';
import { hapticImpact } from '../lib/haptics';

const THUMB_W = 52;

export function SwipeConfirmSlider({
  label,
  onComplete,
  onProgress,
  disabled = false,
}: {
  label: string;
  onComplete: () => void;
  onProgress?: (progress: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const startXRef = useRef(0);
  const maxXRef = useRef(0);
  const completedRef = useRef(false);
  const hapticStepRef = useRef(0);
  const animTimerRef = useRef<number | null>(null);

  const reportProgress = (x: number) => {
    if (!onProgress) return;
    if (maxXRef.current <= 0) {
      onProgress(0);
      return;
    }
    onProgress(Math.min(1, Math.max(0, x / maxXRef.current)));
  };

  useEffect(() => {
    return () => {
      if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    };
  }, []);

  const reset = () => {
    setAnimating(true);
    setDragX(0);
    setDragging(false);
    hapticStepRef.current = 0;
    reportProgress(0);
    if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    animTimerRef.current = window.setTimeout(() => setAnimating(false), 380);
  };

  const finishIfReady = (x: number) => {
    if (completedRef.current) return;
    if (x >= maxXRef.current * 0.88) {
      completedRef.current = true;
      setAnimating(false);
      setDragX(maxXRef.current);
      onProgress?.(1);
      void hapticImpact('medium');
      onComplete();
      return;
    }
    reset();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || completedRef.current) return;
    const track = trackRef.current;
    if (!track) return;
    if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    setAnimating(false);
    maxXRef.current = Math.max(0, track.clientWidth - THUMB_W - 8);
    startXRef.current = e.clientX - dragX;
    setDragging(true);
    hapticStepRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || disabled || completedRef.current) return;
    const next = Math.min(maxXRef.current, Math.max(0, e.clientX - startXRef.current));
    setDragX(next);
    reportProgress(next);
    if (maxXRef.current > 0) {
      const step = Math.floor((next / maxXRef.current) * 24);
      if (step > hapticStepRef.current) {
        hapticStepRef.current = step;
        void hapticImpact('light');
      }
    }
  };

  const onPointerUp = () => {
    if (!dragging || completedRef.current) return;
    finishIfReady(dragX);
  };

  const fillWidth = Math.max(THUMB_W * 0.5, dragX + THUMB_W + 8);

  return (
    <div className={`swipe-confirm${disabled ? ' swipe-confirm--disabled' : ''}`}>
      <div
        ref={trackRef}
        className={`swipe-confirm-track${dragging ? ' swipe-confirm-track--dragging' : ''}`}
      >
        <div
          className="swipe-confirm-fill"
          style={{ width: fillWidth }}
          aria-hidden
        />
        <span className="swipe-confirm-label" style={{ opacity: 1 - Math.min(1, dragX / Math.max(1, maxXRef.current)) * 0.65 }}>
          {label}
        </span>
        <button
          type="button"
          className={`swipe-confirm-thumb${dragging ? ' swipe-confirm-thumb--dragging' : ''}${animating ? ' swipe-confirm-thumb--animating' : ''}`}
          style={{ transform: `translateX(${dragX}px)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          disabled={disabled}
          aria-label={label}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 12h12" />
            <path d="m13 8 4 4-4 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
