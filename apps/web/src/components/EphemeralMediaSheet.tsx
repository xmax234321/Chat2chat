import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import { EphemeralTimerPickerSheet } from './EphemeralTimerPickerSheet';

type Props = {
  open: boolean;
  isVideo?: boolean;
  connected?: boolean;
  onClose: () => void;
  onSend: (ephemeral: EphemeralMedia | null) => void;
  onBlocked?: (message: string) => void;
};

export function EphemeralMediaSheet({
  open,
  isVideo = false,
  connected = true,
  onClose,
  onSend,
  onBlocked,
}: Props) {
  const [timerOpen, setTimerOpen] = useState(false);

  if (!open && !timerOpen) return null;

  const tryTimer = () => {
    if (!connected) {
      onBlocked?.('Timer videos require an internet connection');
      return;
    }
    setTimerOpen(true);
  };

  const rows: { label: string; hint?: string; disabled?: boolean; action: () => void }[] = [
    {
      label: 'Send normally',
      action: () => onSend(null),
    },
    {
      label: 'Delete after view',
      hint: 'Blurred until opened · deleted when closed',
      action: () => onSend({ mode: 'after_view', ttlSec: 86400 }),
    },
    {
      label: 'Delete in set time',
      hint: connected ? 'Choose when it disappears' : 'Requires internet connection',
      disabled: !connected,
      action: tryTimer,
    },
  ];

  return (
    <>
      {open &&
        createPortal(
          <div className="attach-sheet-backdrop fade-in" onClick={onClose} role="presentation">
            <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
              {isVideo && (
                <div className="ephemeral-video-notice" role="status">
                  Preparing video — please wait while you choose how to send
                </div>
              )}
              <div className="attach-sheet-group" role="dialog" aria-modal="true" aria-label="Disappearing media">
                {rows.map((row, index) => (
                  <button
                    key={row.label}
                    type="button"
                    className={`attach-sheet-row attach-sheet-row--icon${
                      index === 0 ? ' attach-sheet-row-first' : ''
                    }${index === rows.length - 1 ? ' attach-sheet-row-last' : ''}${
                      row.disabled ? ' attach-sheet-row--disabled' : ''
                    }`}
                    disabled={row.disabled}
                    onClick={row.action}
                  >
                    <span className="attach-sheet-row-text">
                      <span className="attach-sheet-row-label">{row.label}</span>
                      {row.hint ? <span className="attach-sheet-row-hint">{row.hint}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" className="attach-sheet-group attach-sheet-cancel" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>,
          document.body,
        )}
      <EphemeralTimerPickerSheet
        open={timerOpen}
        connected={connected}
        onClose={() => setTimerOpen(false)}
        onBlocked={onBlocked}
        onConfirm={(ephemeral) => {
          if (!connected) {
            onBlocked?.('Timer videos require an internet connection');
            return;
          }
          onSend(ephemeral);
          setTimerOpen(false);
        }}
      />
    </>
  );
}
