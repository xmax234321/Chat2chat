import { useRef } from 'react';
import { MicIcon } from './Icons';
import { SfPaperplaneIcon } from './settings/SettingsSfIcons';
import type { VoiceRecordPhase } from '../hooks/useVoiceHoldRecord';

type Props = {
  hasText: boolean;
  disabled?: boolean;
  phase: VoiceRecordPhase;
  onSendText: () => void;
  onSendVoice: () => void;
  onStopLocked: () => void;
  onBeginHold: (x: number, y: number) => void | Promise<void | boolean>;
  onDrag: (x: number, y: number) => void;
  onEndHold: () => void;
  consumeSkipClick: () => boolean;
};

export function ChatSendButton({
  hasText,
  disabled,
  phase,
  onSendText,
  onSendVoice,
  onStopLocked,
  onBeginHold,
  onDrag,
  onEndHold,
  consumeSkipClick,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canHoldRecord = !hasText && !disabled && phase !== 'preview';

  const handleClick = () => {
    if (consumeSkipClick()) return;

    if (hasText) {
      onSendText();
      return;
    }

    if (phase === 'preview') {
      onSendVoice();
      return;
    }

    if (phase === 'locked') {
      onStopLocked();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canHoldRecord || e.button !== 0) return;
    btnRef.current?.setPointerCapture(e.pointerId);
    void onBeginHold(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canHoldRecord && phase !== 'holding') return;
    if (phase === 'holding') {
      onDrag(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (btnRef.current?.hasPointerCapture(e.pointerId)) {
      btnRef.current.releasePointerCapture(e.pointerId);
    }
    if (phase === 'holding') {
      onEndHold();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (btnRef.current?.hasPointerCapture(e.pointerId)) {
      btnRef.current.releasePointerCapture(e.pointerId);
    }
    if (phase === 'holding') {
      onEndHold();
    }
  };

  const recording = phase === 'holding' || phase === 'locked';
  const showStop = phase === 'locked';
  const showMic = !hasText && phase !== 'preview' && !showStop;

  let ariaLabel = 'Send';
  if (showMic) ariaLabel = 'Hold to record voice message';
  if (recording) ariaLabel = 'Recording voice message';
  if (showStop) ariaLabel = 'Stop recording';
  if (phase === 'preview') ariaLabel = 'Send voice message';

  return (
    <button
      ref={btnRef}
      type="button"
      className={`send-btn${recording ? ' send-btn--recording' : ''}${showStop ? ' send-btn--stop' : ''}`}
      disabled={disabled && phase === 'idle'}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => canHoldRecord && e.preventDefault()}
      aria-label={ariaLabel}
      style={{ touchAction: 'manipulation' }}
    >
      {showStop ? (
        <span className="send-btn-stop-icon" aria-hidden />
      ) : showMic ? (
        <MicIcon size={18} color="#0B0B0C" />
      ) : (
        <SfPaperplaneIcon size={16} color="#0B0B0C" />
      )}
    </button>
  );
}
