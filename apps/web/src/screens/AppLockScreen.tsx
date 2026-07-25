import { useCallback, useEffect, useRef, useState } from 'react';
import { ForgotPasscodeSheet } from '../components/ForgotPasscodeSheet';
import { PinPad } from '../components/PinPad';
import { EntryAnimation } from '../components/EntryAnimation';
import { formatBuildLabel } from '../lib/build-label';
import { isEntryAnimationEnabled, loadAppLockPreferences } from '../lib/app-lock-settings';
import { isBiometricAvailable } from '../lib/biometric';
import { dismissKeyboard } from '../lib/keyboard-dismiss';
import { isCapacitor } from '../lib/platform';

function AppLockBuildLabel() {
  const label = formatBuildLabel();
  if (!label) return null;
  return <p className="app-lock-build-label">{label}</p>;
}

export function AppLockScreen({
  onUnlock,
  onLogout,
}: {
  onUnlock: (pin: string, viaBiometric?: boolean) => Promise<boolean>;
  onLogout: () => void;
}) {
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState(0);
  const [faceIdMode, setFaceIdMode] = useState(
    () => isCapacitor() && loadAppLockPreferences().faceIdEnabled,
  );
  const faceIdEnabled = isCapacitor() && loadAppLockPreferences().faceIdEnabled;
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [faceIdError, setFaceIdError] = useState('');
  const [introDone, setIntroDone] = useState(() => !isEntryAnimationEnabled());
  const [forgotOpen, setForgotOpen] = useState(false);
  const faceIdBusyRef = useRef(false);

  const openForgot = () => {
    setForgotOpen(true);
    void (async () => {
      await dismissKeyboard();
      await new Promise((r) => window.setTimeout(r, 60));
      await dismissKeyboard();
    })();
  };

  const forgotSheet = (
    <ForgotPasscodeSheet
      open={forgotOpen}
      onClose={() => setForgotOpen(false)}
      onLogout={onLogout}
    />
  );

  const runFaceId = useCallback(async () => {
    if (faceIdBusyRef.current) return;
    faceIdBusyRef.current = true;
    setFaceIdBusy(true);
    setFaceIdError('');
    try {
      const ok = await onUnlock('', true);
      if (!ok) {
        setFaceIdError('Face ID failed. Try again or enter passcode.');
      }
    } finally {
      faceIdBusyRef.current = false;
      setFaceIdBusy(false);
    }
  }, [onUnlock]);

  useEffect(() => {
    if (!introDone || !faceIdMode) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        const available = await isBiometricAvailable();
        if (cancelled) return;
        if (!available) {
          setFaceIdError('Face ID is not available on this device');
          return;
        }
        if (faceIdBusyRef.current) return;
        faceIdBusyRef.current = true;
        setFaceIdBusy(true);
        try {
          const ok = await onUnlock('', true);
          if (!cancelled && !ok) {
            setFaceIdError('Face ID failed. Try again or enter passcode.');
          }
        } finally {
          if (!cancelled) {
            faceIdBusyRef.current = false;
            setFaceIdBusy(false);
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [faceIdMode, onUnlock, introDone]);

  const handleComplete = async (pin: string) => {
    if (unlockBusy) return;
    setError('');
    setUnlockBusy(true);
    try {
      const ok = await onUnlock(pin);
      if (!ok) {
        setError('Incorrect passcode. Try again');
        setResetToken((t) => t + 1);
      }
    } catch {
      setError('Incorrect passcode. Try again');
      setResetToken((t) => t + 1);
    } finally {
      setUnlockBusy(false);
    }
  };

  if (!introDone) {
    return <EntryAnimation variant="lock" onComplete={() => setIntroDone(true)} />;
  }

  if (faceIdMode) {
    return (
      <div className="app-lock-screen">
        <div className="app-lock-card">
          <div className="app-lock-glyph" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.9" />
            </svg>
          </div>
          <h2 className="pin-pad-title">Enter passcode</h2>
          <p className="pin-pad-subtitle">or use Face ID</p>
          {faceIdError && <p className="pin-pad-error">{faceIdError}</p>}
          <button
            type="button"
            className="app-lock-faceid"
            onClick={() => void runFaceId()}
            disabled={faceIdBusy}
            aria-label="Unlock with Face ID"
          >
            <div className="app-lock-faceid-frame" aria-hidden>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
                <path d="M9 10v1M15 10v1M12 10v3l-1 1M9.5 15a3.5 3.5 0 0 0 5 0" />
              </svg>
            </div>
            <div className="app-lock-faceid-hint">{faceIdBusy ? 'Checking Face ID…' : 'Look at your phone'}</div>
          </button>
          <button type="button" className="app-lock-faceid-fallback" onClick={() => setFaceIdMode(false)}>
            Enter passcode instead
          </button>
          <button type="button" className="app-lock-faceid-fallback" onClick={openForgot}>
            Forgot passcode?
          </button>
          <AppLockBuildLabel />
        </div>
        {forgotSheet}
      </div>
    );
  }

  return (
    <div className="app-lock-screen app-lock-screen--passcode">
      <div className="app-lock-passcode-cluster">
        <div className={`app-lock-glyph${error ? ' app-lock-glyph-error' : ''}`} aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.9" />
          </svg>
        </div>

        <PinPad
          title="Enter passcode"
          subtitle="Unlock Chat2Chat to continue"
          error={error}
          busy={unlockBusy}
          resetToken={resetToken}
          keyboardPaused={forgotOpen}
          onComplete={(pin) => void handleComplete(pin)}
          onPinChange={() => setError('')}
        />
        {faceIdEnabled && (
          <button
            type="button"
            className="app-lock-faceid-fallback app-lock-faceid-fallback--passcode"
            onClick={() => void runFaceId()}
            disabled={faceIdBusy || unlockBusy}
          >
            {faceIdBusy ? 'Checking Face ID…' : 'Unlock with Face ID'}
          </button>
        )}
        {faceIdError && <p className="pin-pad-error">{faceIdError}</p>}
        <button type="button" className="app-lock-faceid-fallback app-lock-faceid-fallback--passcode" onClick={openForgot}>
          Forgot passcode?
        </button>
        <AppLockBuildLabel />
      </div>
      {forgotSheet}
    </div>
  );
}
