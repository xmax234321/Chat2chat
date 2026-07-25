import { Capacitor } from '@capacitor/core';

type CapacitorWindow = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.chat2chat?.isElectron);
}

export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.chat2chat?.isCapacitor) return true;
  return Capacitor.isNativePlatform();
}

/** True when running inside the iOS/Android app shell. */
export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isDesktopShell(): boolean {
  return isElectron() || isTauri();
}

export function isMobileShell(): boolean {
  return isCapacitor();
}

export function isIosCapacitor(): boolean {
  if (!isCapacitor()) return false;
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  return cap?.getPlatform?.() === 'ios';
}
