import { memo, useEffect, useRef, useState } from 'react';
import { exportBlockCountdownParts } from '../lib/export-block-lock';

const DIGIT_W = 22;
const DIGIT_H = 40;

const SlidingDigit = memo(function SlidingDigit({ digit }: { digit: string }) {
  const currentRef = useRef(digit);
  const [roll, setRoll] = useState<{ key: number; prev: string; next: string } | null>(null);

  useEffect(() => {
    if (digit === currentRef.current) return;
    const prev = currentRef.current;
    currentRef.current = digit;
    setRoll({ key: Date.now(), prev, next: digit });
    const timer = window.setTimeout(() => setRoll(null), 420);
    return () => window.clearTimeout(timer);
  }, [digit]);

  if (!roll) {
    return (
      <span
        className="export-countdown-digit-slot"
        style={{ width: DIGIT_W, height: DIGIT_H }}
        aria-hidden
      >
        <span className="export-countdown-digit">{digit}</span>
      </span>
    );
  }

  return (
    <span
      className="export-countdown-digit-slot"
      style={{ width: DIGIT_W, height: DIGIT_H }}
      aria-hidden
    >
      <span className="export-countdown-digit-roll" key={roll.key}>
        <span className="export-countdown-digit">{roll.next}</span>
        <span className="export-countdown-digit">{roll.prev}</span>
      </span>
    </span>
  );
});

const AnimatedUnit = memo(function AnimatedUnit({
  value,
  pad = 2,
}: {
  value: number;
  pad?: number;
}) {
  const digits = String(value).padStart(pad, '0').split('');
  return (
    <span className="export-countdown-unit" style={{ width: DIGIT_W * pad }}>
      {digits.map((d, index) => (
        <SlidingDigit key={index} digit={d} />
      ))}
    </span>
  );
});

export const ExportBlockCountdown = memo(function ExportBlockCountdown({
  remainingMs,
}: {
  remainingMs: number;
}) {
  const { hours, minutes, seconds } = exportBlockCountdownParts(remainingMs);
  const hourPad = hours >= 100 ? 3 : 2;

  return (
    <div className="export-countdown" aria-live="polite">
      <div className="export-countdown-display">
        <div className="export-countdown-group">
          <AnimatedUnit value={hours} pad={hourPad} />
          <span className="export-countdown-unit-label">hours</span>
        </div>
        <span className="export-countdown-sep">:</span>
        <div className="export-countdown-group">
          <AnimatedUnit value={minutes} />
          <span className="export-countdown-unit-label">minutes</span>
        </div>
        <span className="export-countdown-sep">:</span>
        <div className="export-countdown-group">
          <AnimatedUnit value={seconds} />
          <span className="export-countdown-unit-label">seconds</span>
        </div>
      </div>
    </div>
  );
});
