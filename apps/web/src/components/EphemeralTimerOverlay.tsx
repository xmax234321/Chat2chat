import { memo } from 'react';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import { EphemeralCountdownBadge } from '../hooks/useEphemeralCountdown';
import { EyeOffIcon } from './Icons';

export const EphemeralTimerOverlay = memo(function EphemeralTimerOverlay({
  ephemeral,
  messageTimestamp,
  showEye = true,
}: {
  ephemeral?: EphemeralMedia | null;
  messageTimestamp: number;
  showEye?: boolean;
}) {
  if (!ephemeral) return null;

  return (
    <>
      {showEye && (
        <span className="media-ephemeral-overlay" aria-hidden>
          <EyeOffIcon size={28} color="#F4F4F3" />
        </span>
      )}
      {ephemeral.mode === 'timer' && (
        <EphemeralCountdownBadge
          ephemeral={ephemeral}
          messageTimestamp={messageTimestamp}
          className="media-ephemeral-countdown--bubble"
        />
      )}
    </>
  );
});
