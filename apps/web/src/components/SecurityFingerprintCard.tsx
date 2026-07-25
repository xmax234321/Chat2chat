import { useEffect, useRef, useState } from 'react';

export function SecurityFingerprintCard({
  value,
  displayValue,
  onCopy,
}: {
  value: string;
  displayValue?: string;
  onCopy: () => void | Promise<void>;
}) {
  const [revealed, setRevealed] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!revealed) return;
    idleTimerRef.current = window.setTimeout(() => setRevealed(false), 5000);
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [revealed, value]);

  const handleClick = () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    void Promise.resolve(onCopy()).finally(() => setRevealed(false));
  };

  const rows = (() => {
    const raw = (displayValue ?? value).replace(/\s+/g, '');
    const groups = raw.match(/.{1,5}/g) ?? [raw];
    const out: string[] = [];
    for (let i = 0; i < groups.length; i += 3) {
      out.push(groups.slice(i, i + 3).join(' '));
    }
    while (out.length < 4) out.push('');
    return out.slice(0, 4);
  })();

  return (
    <button type="button" className="settings-fig-fingerprint" onClick={handleClick}>
      {revealed ? (
        <span className="settings-fig-fingerprint-value settings-fig-fingerprint-value--rows">
          {rows.map((row, i) => (
            <span key={i} className="settings-fig-fingerprint-row">
              {row}
            </span>
          ))}
        </span>
      ) : (
        <span className="settings-fig-fingerprint-placeholder">
          <span>Your fingerprint</span>
          <span>tap to reveal</span>
        </span>
      )}
    </button>
  );
}
