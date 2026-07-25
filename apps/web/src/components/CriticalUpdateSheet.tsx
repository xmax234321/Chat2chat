import { createPortal } from 'react-dom';
import { dismissCriticalUpdate } from '../lib/app-updates';

export function CriticalUpdateSheet({
  open,
  latestVersion,
  message,
  onDismiss,
}: {
  open: boolean;
  latestVersion: string;
  message?: string;
  onDismiss: () => void;
}) {
  if (!open) return null;

  const handleContinue = () => {
    dismissCriticalUpdate(latestVersion);
    onDismiss();
  };

  return createPortal(
    <div className="critical-update-backdrop" role="presentation">
      <div className="critical-update-sheet" role="dialog" aria-modal="true" aria-labelledby="critical-update-title">
        <div className="critical-update-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h2 id="critical-update-title" className="critical-update-title">
          Security update available
        </h2>
        <p className="critical-update-body">
          {message ??
            `A critical security update (${latestVersion}) is available. Update via AltStore when you can.`}
        </p>
        <div className="critical-update-actions">
          <button type="button" className="btn-primary critical-update-btn" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
