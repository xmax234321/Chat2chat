import { useState } from 'react';
import { ChevronRight } from './Icons';
import { ToggleSwitch } from './ToggleSwitch';
import {
  AUTO_LOCK_OPTIONS,
  autoLockLabel,
  loadAppLockPreferences,
  saveAppLockPreferences,
  type AutoLockDelay,
} from '../lib/app-lock-settings';
import { isCapacitor } from '../lib/platform';
import { authenticateBiometric, isBiometricAvailable } from '../lib/biometric';
import { storeBiometricUnlockKey, clearBiometricUnlockKey } from '../lib/state-storage';
import { useToast } from './Toast';

export function PinSettingsOptions({
  onChangePasscode,
  onDisable,
  onLockNow,
  disableBusy,
}: {
  onChangePasscode: () => void;
  onDisable: () => void;
  onLockNow: () => void;
  disableBusy?: boolean;
}) {
  const { show } = useToast();
  const [prefs, setPrefs] = useState(loadAppLockPreferences);
  const [autoLockOpen, setAutoLockOpen] = useState(false);

  const setFaceId = async (faceIdEnabled: boolean) => {
    if (faceIdEnabled) {
      const available = await isBiometricAvailable();
      if (!available) {
        show('Face ID is not available — enroll Face ID in iOS Settings');
        return;
      }
      const auth = await authenticateBiometric('Enable Face ID for Chat2Chat', 'enable');
      if (!auth.success) {
        if (auth.error === 'cancelled') {
          show('Face ID not enabled');
        } else if (auth.error === 'unavailable') {
          show('Face ID is not available on this device');
        } else {
          show('Could not verify Face ID — try again');
        }
        return;
      }
      const stored = await storeBiometricUnlockKey();
      if (!stored) {
        show('Could not save Face ID unlock key — unlock with passcode first');
        return;
      }
    } else {
      await clearBiometricUnlockKey();
    }
    const next = saveAppLockPreferences({ faceIdEnabled });
    setPrefs(next);
    show(faceIdEnabled ? 'Face ID enabled' : 'Face ID disabled');
  };

  const setAutoLock = (autoLockSeconds: AutoLockDelay) => {
    const next = saveAppLockPreferences({ autoLockSeconds });
    setPrefs(next);
    setAutoLockOpen(false);
  };

  return (
    <div className="pin-settings-enabled">
      <div className="pin-settings-ok">
        <div className="pin-settings-ok-icon" aria-hidden>✓</div>
        <div className="pin-settings-ok-title">Passcode set</div>
        <div className="pin-settings-ok-note">Chat2Chat will lock when you leave it</div>
      </div>

      <div className="pin-settings-card">
        {isCapacitor() && (
          <div className="pin-settings-row pin-settings-row-toggle">
            <span>Unlock with Face ID</span>
            <ToggleSwitch
              checked={prefs.faceIdEnabled}
              onChange={(enabled) => void setFaceId(enabled)}
              ariaLabel="Unlock with Face ID"
            />
          </div>
        )}
        <button type="button" className="pin-settings-row" onClick={() => setAutoLockOpen((v) => !v)}>
          <span>Auto-lock</span>
          <span className="pin-settings-row-meta">{autoLockLabel(prefs.autoLockSeconds)}</span>
          <ChevronRight />
        </button>
      </div>

      {autoLockOpen && (
        <div className="pin-settings-card pin-settings-auto-lock">
          {AUTO_LOCK_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="pin-settings-row"
              onClick={() => setAutoLock(option.value)}
            >
              <span>{option.label}</span>
              {prefs.autoLockSeconds === option.value && <span style={{ color: '#7FB88A' }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      <div className="label-caps pin-settings-manage-label">Manage</div>
      <div className="pin-settings-card">
        <button type="button" className="pin-settings-row" onClick={onChangePasscode}>
          <span>Change passcode</span>
          <ChevronRight />
        </button>
        <button type="button" className="pin-settings-row" onClick={onLockNow}>
          <span>Lock now</span>
        </button>
        <button
          type="button"
          className="pin-settings-row pin-settings-row-danger"
          disabled={disableBusy}
          onClick={onDisable}
        >
          <span>Turn off app lock</span>
        </button>
      </div>
    </div>
  );
}
