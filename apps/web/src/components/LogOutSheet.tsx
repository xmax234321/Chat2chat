import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PinPad } from './PinPad';
import { SwipeConfirmSlider } from './SwipeConfirmSlider';
import { verifyAppLockPassword } from '../lib/app-lock';
import { dismissKeyboard } from '../lib/keyboard-dismiss';
import { SfIcloudIcon, SfLogoutCircleIcon } from './settings/SettingsSfIcons';

type Step = 'pin' | 'backup' | 'slide';

function nextStepAfterPin(hasBackup: boolean): Step {
  return hasBackup ? 'slide' : 'backup';
}

function initialStep(pinRequired: boolean, hasBackup: boolean): Step {
  if (pinRequired) return 'pin';
  return hasBackup ? 'slide' : 'backup';
}

export function LogOutSheet({
  open,
  pinRequired,
  hasBackup = false,
  onClose,
  onLogout,
}: {
  open: boolean;
  pinRequired: boolean;
  hasBackup?: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(initialStep(pinRequired, hasBackup));
  const [pinError, setPinError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const [slideProgress, setSlideProgress] = useState(0);
  const [pinReady, setPinReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(initialStep(pinRequired, hasBackup));
    setPinError('');
    setBusy(false);
    setSlideProgress(0);
    setPinReady(false);
    setResetToken((t) => t + 1);
    void dismissKeyboard();
  }, [open, pinRequired, hasBackup]);

  useEffect(() => {
    if (!open || step !== 'pin') {
      setPinReady(false);
      return;
    }
    const timer = window.setTimeout(() => setPinReady(true), 320);
    return () => window.clearTimeout(timer);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('logout-sheet-open');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.classList.remove('logout-sheet-open');
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const subtitle =
    step === 'pin'
      ? 'Enter your PIN to continue'
      : step === 'backup'
        ? 'Create a backup so you can restore your chats after logging out.'
        : 'You can recover your account later with your recovery phrase.';

  return createPortal(
    <div
      className="share-contact-backdrop logout-sheet-backdrop"
      style={{
        backdropFilter: `blur(${slideProgress * 14}px)`,
        WebkitBackdropFilter: `blur(${slideProgress * 14}px)`,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="share-contact-sheet logout-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Log out"
      >
        <div className="share-contact-handle" aria-hidden />
        <div className="logout-sheet-head">
          <span className="logout-sheet-icon" aria-hidden>
            <SfLogoutCircleIcon size={22} />
          </span>
          <div className="share-contact-title">Log out</div>
          <p className="logout-sheet-sub">{subtitle}</p>
        </div>

        {step === 'pin' ? (
          <div className="logout-sheet-pin">
            <PinPad
              title="Enter PIN"
              error={pinError}
              busy={busy}
              resetToken={resetToken}
              autoFocus={pinReady}
              keyboardPaused={!pinReady}
              onPinChange={() => setPinError('')}
              onComplete={(pin) => {
                setBusy(true);
                const ok = verifyAppLockPassword(pin);
                if (!ok) {
                  setPinError('Wrong PIN');
                  setResetToken((t) => t + 1);
                  setBusy(false);
                  return;
                }
                setBusy(false);
                setStep(nextStepAfterPin(hasBackup));
              }}
            />
          </div>
        ) : step === 'backup' ? (
          <div className="logout-sheet-backup">
            <div className="logout-sheet-backup-card">
              <span className="logout-sheet-backup-icon" aria-hidden>
                <SfIcloudIcon size={22} />
              </span>
              <p>Your messages stay on this device until you back them up.</p>
            </div>
            <button
              type="button"
              className="btn-primary logout-sheet-backup-btn"
              onClick={() => {
                onClose();
                navigate('/settings/backup');
              }}
            >
              Back up now
            </button>
            <button type="button" className="btn-ghost logout-sheet-backup-skip" onClick={() => setStep('slide')}>
              Continue without backup
            </button>
          </div>
        ) : (
          <div className="logout-sheet-slide">
            <SwipeConfirmSlider
              label="Slide to log out"
              disabled={busy}
              onProgress={setSlideProgress}
              onComplete={() => {
                setBusy(true);
                onLogout();
              }}
            />
          </div>
        )}

        <button type="button" className="attach-sheet-group attach-sheet-cancel logout-sheet-cancel" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
