import { loadState, saveState } from './types';

export type AutoLockDelay = 0 | 60 | 300 | 900;

export interface AppLockPreferences {
  faceIdEnabled: boolean;
  autoLockSeconds: AutoLockDelay;
  /** Branded intro animation on app open and PIN screen */
  entryAnimationEnabled: boolean;
}

const DEFAULT: AppLockPreferences = {
  faceIdEnabled: false,
  autoLockSeconds: 60,
  entryAnimationEnabled: false,
};

export const AUTO_LOCK_OPTIONS: Array<{ value: AutoLockDelay; label: string }> = [
  { value: 0, label: 'Immediately' },
  { value: 60, label: 'After 1 min' },
  { value: 300, label: 'After 5 min' },
  { value: 900, label: 'After 15 min' },
];

export function loadAppLockPreferences(): AppLockPreferences {
  const prefs = loadState().appLockPrefs;
  if (!prefs) return { ...DEFAULT };
  return {
    faceIdEnabled: Boolean(prefs.faceIdEnabled),
    autoLockSeconds: (prefs.autoLockSeconds ?? 60) as AutoLockDelay,
    entryAnimationEnabled: Boolean(prefs.entryAnimationEnabled),
  };
}

export function saveAppLockPreferences(patch: Partial<AppLockPreferences>): AppLockPreferences {
  const next = { ...loadAppLockPreferences(), ...patch };
  saveState({ appLockPrefs: next });
  return next;
}

export function autoLockLabel(seconds: AutoLockDelay): string {
  return AUTO_LOCK_OPTIONS.find((o) => o.value === seconds)?.label ?? 'After 1 min';
}

export function isEntryAnimationEnabled(): boolean {
  return loadAppLockPreferences().entryAnimationEnabled;
}
