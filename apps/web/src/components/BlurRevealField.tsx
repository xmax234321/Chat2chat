import { useEffect, useRef, useState } from 'react';

type Props = {
  label?: string;
  value: string;
  displayValue?: string;
  idleMs?: number;
  onCopy: () => void | Promise<void>;
};

export function BlurRevealField({ label, value, displayValue, idleMs = 5000, onCopy }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [readyToCopy, setReadyToCopy] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const blur = () => {
    setRevealed(false);
    setReadyToCopy(false);
  };

  const scheduleBlur = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(blur, idleMs);
  };

  useEffect(() => {
    if (!revealed) {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      return;
    }
    scheduleBlur();
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [revealed, value, idleMs]);

  const handleClick = () => {
    if (!revealed) {
      setRevealed(true);
      setReadyToCopy(true);
      return;
    }
    if (readyToCopy) {
      void Promise.resolve(onCopy()).finally(blur);
    }
  };

  return (
    <button type="button" className="blur-reveal-field" onClick={handleClick}>
      {label ? <div className="label-caps blur-reveal-label">{label}</div> : null}
      <div className={`blur-reveal-value${revealed ? '' : ' blur-reveal-value-hidden'}`}>
        {displayValue ?? value}
      </div>
      {revealed && readyToCopy && <div className="blur-reveal-hint">Tap again to copy</div>}
    </button>
  );
}
