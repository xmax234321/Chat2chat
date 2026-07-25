import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EphemeralTimerPickerSheet } from './EphemeralTimerPickerSheet';
import type { EphemeralMedia } from '../lib/ephemeral-media';

type EphemeralMode = 'normal' | 'after_view' | 'timer';

type Props = {
  open: boolean;
  connected?: boolean;
  ephemeral: EphemeralMedia | null;
  onClose: () => void;
  onConfirm: (ephemeral: EphemeralMedia | null) => void;
  onBlocked?: (message: string) => void;
};

function modeFromEphemeral(ephemeral: EphemeralMedia | null): EphemeralMode {
  if (!ephemeral) return 'normal';
  if (ephemeral.mode === 'after_view') return 'after_view';
  return 'timer';
}

const SEND_MODES = [
  {
    id: 'normal' as const,
    title: 'Send normally',
    description: 'Photo stays in chat like a regular message',
  },
  {
    id: 'after_view' as const,
    title: 'View once',
    description: 'Blurred until opened, then deleted when closed',
  },
  {
    id: 'timer' as const,
    title: 'Disappearing timer',
    description: 'Automatically deleted after the selected time',
  },
];

export function MediaSendOptionsSheet({
  open,
  connected = true,
  ephemeral,
  onClose,
  onConfirm,
  onBlocked,
}: Props) {
  const [mode, setMode] = useState<EphemeralMode>('normal');
  const [timerSec, setTimerSec] = useState(60);
  const [timerSheetOpen, setTimerSheetOpen] = useState(false);
  const openedOnceRef = useRef(false);

  useEffect(() => {
    if (!open) {
      openedOnceRef.current = false;
      setTimerSheetOpen(false);
      return;
    }
    if (openedOnceRef.current) return;
    openedOnceRef.current = true;
    setMode(modeFromEphemeral(ephemeral));
    setTimerSec(ephemeral?.mode === 'timer' ? ephemeral.ttlSec : 60);
  }, [open, ephemeral]);

  const buildEphemeral = (): EphemeralMedia | null => {
    if (mode === 'after_view') return { mode: 'after_view', ttlSec: 86400 };
    if (mode === 'timer') return { mode: 'timer', ttlSec: Math.max(5, timerSec) };
    return null;
  };

  const confirm = () => {
    const next = buildEphemeral();
    if (next?.mode === 'timer' && !connected) {
      onBlocked?.('Timer media requires an internet connection');
      return;
    }
    onConfirm(next);
    onClose();
  };

  const selectMode = (nextMode: EphemeralMode) => {
    if (nextMode === 'timer') {
      if (!connected) {
        onBlocked?.('Timer media requires an internet connection');
        return;
      }
      setMode('timer');
      setTimerSheetOpen(true);
      return;
    }
    setMode(nextMode);
    setTimerSheetOpen(false);
  };

  if (!open) return null;

  return createPortal(
    <>
      <button type="button" className="media-send-options-backdrop" onClick={onClose} aria-label="Close" />
      <div className="media-send-options-sheet" role="dialog" aria-modal="true" aria-label="How to send">
        <div className="media-send-options-sheet-header">
          <span className="media-send-options-sheet-title">How to send</span>
          <button type="button" className="media-send-options-sheet-done" onClick={confirm}>
            Done
          </button>
        </div>

        <div className="media-send-options-sheet-body">
          <p className="media-send-options-sheet-lead">
            Choose how this media should appear in chat.
          </p>

          <div className="media-send-options-list">
            {SEND_MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`media-send-options-row${mode === option.id ? ' active' : ''}`}
                onClick={() => selectMode(option.id)}
              >
                <span className="media-send-options-row-copy">
                  <span className="media-send-options-row-title">{option.title}</span>
                  <span className="media-send-options-row-desc">{option.description}</span>
                  {option.id === 'timer' && mode === 'timer' ? (
                    <span className="media-send-options-row-meta">
                      {timerSec >= 60 ? `${Math.round(timerSec / 60)} min` : `${timerSec} sec`}
                    </span>
                  ) : null}
                </span>
                <span className={`media-send-options-radio${mode === option.id ? ' active' : ''}`} aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      <EphemeralTimerPickerSheet
        open={timerSheetOpen}
        connected={connected}
        onClose={() => setTimerSheetOpen(false)}
        onBlocked={onBlocked}
        onConfirm={(next) => {
          setMode('timer');
          setTimerSec(next.ttlSec);
          setTimerSheetOpen(false);
        }}
      />
    </>,
    document.body,
  );
}
