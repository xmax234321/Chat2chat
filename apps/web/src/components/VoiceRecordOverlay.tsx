import { LockIcon } from './Icons';
import { formatRecordMs } from '../hooks/useVoiceHoldRecord';
import type { VoiceDragHint, VoiceRecordPhase } from '../hooks/useVoiceHoldRecord';

type Props = {
  phase: VoiceRecordPhase;
  elapsed: number;
  dragHint: VoiceDragHint;
};

export function VoiceRecordOverlay({ phase, elapsed, dragHint }: Props) {
  if (phase !== 'holding' && phase !== 'locked' && phase !== 'arming') return null;

  const locked = phase === 'locked';

  return (
    <div className="voice-hold-overlay" aria-live="polite">
      <div className={`voice-hold-lock-zone${dragHint === 'lock' || locked ? ' voice-hold-zone--active' : ''}`}>
        <LockIcon size={22} color="currentColor" />
        <span>{locked ? 'Recording locked' : 'Slide up to lock'}</span>
      </div>

      <div className="voice-hold-timer">{formatRecordMs(elapsed)}</div>

      {!locked ? (
        <div className={`voice-hold-cancel-zone${dragHint === 'cancel' ? ' voice-hold-zone--active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          <span>Slide left to cancel</span>
        </div>
      ) : (
        <p className="voice-hold-locked-hint">Tap send to finish</p>
      )}
    </div>
  );
}
