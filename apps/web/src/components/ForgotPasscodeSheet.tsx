import { createPortal } from 'react-dom';
import { SfLogoutCircleIcon } from './settings/SettingsSfIcons';

type Props = {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
};

export function ForgotPasscodeSheet({ open, onClose, onLogout }: Props) {
  if (!open) return null;

  return createPortal(
    <div className="share-contact-backdrop app-lock-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="share-contact-sheet forgot-passcode-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="share-contact-handle" aria-hidden />
        <span className="logout-sheet-icon" aria-hidden>
          <SfLogoutCircleIcon size={22} />
        </span>
        <h2 className="share-contact-title">Forgot passcode?</h2>
        <p className="forgot-passcode-copy">
          To reset your passcode, log out and sign in again with your recovery phrase.
        </p>
        <button
          type="button"
          className="btn-primary forgot-passcode-logout"
          onClick={() => {
            onLogout();
            onClose();
          }}
        >
          Log out
        </button>
        <button type="button" className="attach-sheet-group attach-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
