import { createPortal } from 'react-dom';
import type { AppLockPasscodeType } from '../lib/app-lock';
import { passcodeTypeLabel } from '../lib/app-lock';

const OPTIONS: AppLockPasscodeType[] = ['6', '4', 'alphanumeric'];

type Props = {
  open: boolean;
  value: AppLockPasscodeType;
  onClose: () => void;
  onSelect: (type: AppLockPasscodeType) => void;
};

export function PasscodeTypeSheet({ open, value, onClose, onSelect }: Props) {
  if (!open) return null;

  return createPortal(
    <div className="attach-sheet-backdrop fade-in" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="attach-sheet-group" role="dialog" aria-modal="true" aria-label="Passcode type">
          {OPTIONS.map((type, index) => (
            <button
              key={type}
              type="button"
              className={`attach-sheet-row attach-sheet-row--icon${
                index === 0 ? ' attach-sheet-row-first' : ''
              }${index === OPTIONS.length - 1 ? ' attach-sheet-row-last' : ''}${
                value === type ? ' attach-sheet-row--selected' : ''
              }`}
              onClick={() => {
                onSelect(type);
                onClose();
              }}
            >
              <span className="attach-sheet-row-label">{passcodeTypeLabel(type)}</span>
              {value === type ? <span className="attach-sheet-row-check">✓</span> : null}
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
