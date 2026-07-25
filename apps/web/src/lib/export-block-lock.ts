export const EXPORT_BLOCK_LOCK_MS = 24 * 60 * 60 * 1000;

export function isExportBlockForPeerActive(contact: { exportBlockForPeerAt?: number }): boolean {
  return typeof contact.exportBlockForPeerAt === 'number';
}

export function canDisableExportBlockForPeer(enabledAt?: number, now = Date.now()): boolean {
  if (!enabledAt) return false;
  return now - enabledAt >= EXPORT_BLOCK_LOCK_MS;
}

export function exportBlockRemainingMs(enabledAt: number, now = Date.now()): number {
  return Math.max(0, enabledAt + EXPORT_BLOCK_LOCK_MS - now);
}

export function exportBlockCountdownParts(totalMs: number): { hours: number; minutes: number; seconds: number } {
  const totalSec = Math.max(0, Math.ceil(totalMs / 1000));
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

export function formatExportBlockRemaining(totalMs: number): string {
  const totalSec = Math.max(0, Math.ceil(totalMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  return parts.join(', ');
}
