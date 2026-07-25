import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { exportBlockRemainingMs } from '../lib/export-block-lock';
import { ExportBlockCountdown } from './ExportBlockCountdown';

export type ExportBlockSheetMode = 'enable' | 'locked' | 'disable';

type Props = {
  open: boolean;
  mode: ExportBlockSheetMode;
  contactName: string;
  exportBlockForPeerAt?: number;
  onClose: () => void;
  onConfirm: () => void;
};

function useLiveRemainingMs(enabledAt?: number, active = false): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    enabledAt != null ? exportBlockRemainingMs(enabledAt) : null,
  );

  useEffect(() => {
    if (!active || enabledAt == null) return;
    const tick = () => setRemainingMs(exportBlockRemainingMs(enabledAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, enabledAt]);

  return remainingMs;
}

export function ExportBlockSheet({
  open,
  mode,
  contactName,
  exportBlockForPeerAt,
  onClose,
  onConfirm,
}: Props) {
  const remainingMs = useLiveRemainingMs(exportBlockForPeerAt, open && mode === 'locked');

  if (!open) return null;

  const title =
    mode === 'enable'
      ? 'Block export chat'
      : mode === 'locked'
        ? 'Export block is active'
        : 'Allow chat export?';

  const hint =
    mode === 'enable'
      ? `${contactName} will see a message in this chat. You can turn this off only after 24 hours.`
      : mode === 'locked'
        ? 'You can turn off export block when the timer ends.'
        : `${contactName} will be able to export this chat again.`;

  const confirmLabel = mode === 'disable' ? 'Allow export' : 'Turn on';
  const showConfirm = mode === 'enable' || mode === 'disable';

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div
        className="create-group-sheet share-contact-sheet export-block-sheet"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="export-block-title"
      >
        <div className="create-group-sheet-top">
          <span className="create-group-nav-spacer" />
          <span id="export-block-title" className="create-group-sheet-title">
            {title}
          </span>
          <button type="button" className="create-group-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="export-block-sheet-body">
          {mode === 'locked' && remainingMs != null && (
            <ExportBlockCountdown remainingMs={remainingMs} />
          )}
          <p className="create-group-step-hint export-block-sheet-hint">{hint}</p>
        </div>

        <div className="export-block-sheet-actions">
          {showConfirm && (
            <button type="button" className="btn-primary export-block-sheet-primary" onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
          <button type="button" className="export-block-sheet-dismiss" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
