import { createPortal } from 'react-dom';
import type { SendQuality } from '../lib/pick-media';

type Props = {
  open: boolean;
  isVideo?: boolean;
  onClose: () => void;
  onSend: (quality: SendQuality) => void;
};

export function SendQualitySheet({ open, isVideo = false, onClose, onSend }: Props) {
  if (!open) return null;

  const rows: { label: string; hint: string; quality: SendQuality }[] = [
    {
      label: 'Full quality',
      hint: isVideo ? 'Original video, larger upload' : 'Original size and resolution',
      quality: 'full',
    },
    {
      label: 'Compressed',
      hint: isVideo ? 'Smaller file, faster to send' : 'Optimized for chat',
      quality: 'compressed',
    },
  ];

  return createPortal(
    <div className="attach-sheet-backdrop fade-in" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="attach-sheet-group" role="dialog" aria-modal="true" aria-label="Send quality">
          {rows.map((row, index) => (
            <button
              key={row.quality}
              type="button"
              className={`attach-sheet-row attach-sheet-row--icon${
                index === 0 ? ' attach-sheet-row-first' : ''
              }${index === rows.length - 1 ? ' attach-sheet-row-last' : ''}`}
              onClick={() => {
                onSend(row.quality);
              }}
            >
              <span className="attach-sheet-row-text">
                <span className="attach-sheet-row-label">{row.label}</span>
                <span className="attach-sheet-row-hint">{row.hint}</span>
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
  );
}
