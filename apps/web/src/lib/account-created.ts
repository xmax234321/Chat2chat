import { loadState, saveState } from './state-storage';

export function loadAccountCreatedAt(): number | null {
  const ts = loadState().accountCreatedAt;
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : null;
}

/** Persist account creation time once (new accounts / first onboarding). */
export function ensureAccountCreatedAt(timestamp = Date.now()): number {
  const existing = loadAccountCreatedAt();
  if (existing) return existing;
  saveState({ accountCreatedAt: timestamp });
  return timestamp;
}

export function formatAccountCreatedAt(timestamp: number | null): string {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
