import { useEffect, useState } from 'react';
import {
  ephemeralSecondsRemaining,
  formatEphemeralCountdown,
  type EphemeralMedia,
} from '../lib/ephemeral-media';

export function useEphemeralCountdown(
  ephemeral: EphemeralMedia | undefined | null,
  messageTimestamp: number,
): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    ephemeral?.mode === 'timer' ? ephemeralSecondsRemaining(ephemeral, messageTimestamp) : null,
  );

  useEffect(() => {
    if (!ephemeral || ephemeral.mode !== 'timer') {
      setRemaining(null);
      return;
    }
    const tick = () => {
      setRemaining(ephemeralSecondsRemaining(ephemeral, messageTimestamp));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [ephemeral, messageTimestamp]);

  return remaining;
}

export function EphemeralCountdownBadge({
  ephemeral,
  messageTimestamp,
  className,
}: {
  ephemeral?: EphemeralMedia | null;
  messageTimestamp: number;
  className?: string;
}) {
  const remaining = useEphemeralCountdown(ephemeral, messageTimestamp);
  if (remaining == null) return null;

  return (
    <span className={`media-ephemeral-countdown${className ? ` ${className}` : ''}`} aria-live="polite">
      {formatEphemeralCountdown(remaining)}
    </span>
  );
}
