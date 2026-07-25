const STORAGE_KEY = 'chat2chat-safe-mode-backup';

let memoryBlob: string | null = null;

export function storeBackup(blob: string): void {
  memoryBlob = blob;
  try {
    sessionStorage.setItem(STORAGE_KEY, blob);
  } catch {
    /* quota */
  }
}

export function loadBackup(): string | null {
  if (memoryBlob) return memoryBlob;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) memoryBlob = stored;
    return stored;
  } catch {
    return null;
  }
}

export function clearBackup(): void {
  memoryBlob = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasBackup(): boolean {
  return Boolean(loadBackup());
}

/** Internal password for auto-backup while in safe mode — not user-facing. */
export const SAFE_MODE_INTERNAL_PASSWORD = '__c2c_safe_mode_vault__';
