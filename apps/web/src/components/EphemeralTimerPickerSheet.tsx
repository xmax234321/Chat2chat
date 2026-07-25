import { createPortal } from 'react-dom';
import { useMemo, useRef, useState } from 'react';
import type { EphemeralMedia } from '../lib/ephemeral-media';

const ITEM_H = 36;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function WheelColumn({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const values = useMemo(() => Array.from({ length: max + 1 }, (_, i) => i), [max]);

  const snap = () => {
    const el = ref.current;
    if (!el) return;
    const idx = clamp(Math.round(el.scrollTop / ITEM_H), 0, max);
    onChange(idx);
    el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
  };

  return (
    <div className="ephemeral-wheel-col">
      <div className="ephemeral-wheel-label">{label}</div>
      <div className="ephemeral-wheel-mask">
        <div
          ref={ref}
          className="ephemeral-wheel-scroll"
          onScroll={() => window.clearTimeout((ref.current as HTMLDivElement & { _t?: number })._t)}
          onTouchEnd={snap}
          onMouseUp={snap}
          onWheel={() => {
            window.clearTimeout((ref.current as HTMLDivElement & { _t?: number })._t);
            (ref.current as HTMLDivElement & { _t?: number })._t = window.setTimeout(snap, 120);
          }}
          style={{ paddingTop: PAD * ITEM_H, paddingBottom: PAD * ITEM_H }}
        >
          {values.map((n) => (
            <div
              key={n}
              className={`ephemeral-wheel-item${n === value ? ' ephemeral-wheel-item--active' : ''}`}
              onClick={() => {
                onChange(n);
                ref.current?.scrollTo({ top: n * ITEM_H, behavior: 'smooth' });
              }}
            >
              {String(n).padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EphemeralTimerPickerSheet({
  open,
  connected = true,
  onClose,
  onConfirm,
  onBlocked,
}: {
  open: boolean;
  connected?: boolean;
  onClose: () => void;
  onConfirm: (ephemeral: EphemeralMedia) => void;
  onBlocked?: (message: string) => void;
}) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);

  if (!open) return null;

  const ttlSec = hours * 3600 + minutes * 60 + seconds;

  return createPortal(
    <div className="ephemeral-timer-backdrop fade-in" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="ephemeral-timer-sheet" role="dialog" aria-modal="true" aria-label="Delete timer">
          <div className="ephemeral-timer-title">Delete in</div>
          <div className="ephemeral-timer-wheels">
            <WheelColumn label="hr" value={hours} max={23} onChange={setHours} />
            <WheelColumn label="min" value={minutes} max={59} onChange={setMinutes} />
            <WheelColumn label="sec" value={seconds} max={59} onChange={setSeconds} />
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 16 }}
            disabled={ttlSec < 5 || !connected}
            onClick={() => {
              if (!connected) {
                onBlocked?.('Timer videos require an internet connection');
                return;
              }
              onConfirm({ mode: 'timer', ttlSec: Math.max(5, ttlSec) });
              onClose();
            }}
          >
            Set timer
          </button>
        </div>
        <button type="button" className="attach-sheet-group attach-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
