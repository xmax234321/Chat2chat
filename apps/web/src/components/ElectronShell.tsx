import { useEffect } from 'react';
import { isElectron } from '../lib/platform';

/** Enables draggable window regions in the Electron desktop app. */
export function ElectronShell() {
  useEffect(() => {
    if (!isElectron()) return;
    document.documentElement.classList.add('electron-shell');
    return () => document.documentElement.classList.remove('electron-shell');
  }, []);
  return null;
}
