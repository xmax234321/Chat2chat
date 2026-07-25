/** Disappearing photo/video — not forwardable, not in backup. */
export type EphemeralMedia = {
  mode: 'after_view' | 'timer';
  /** Auto-delete after this many seconds (timer mode, or max lifetime). */
  ttlSec: number;
};

export const EPHEMERAL_TIMER_OPTIONS = [
  { label: '10 seconds', ttlSec: 10 },
  { label: '30 seconds', ttlSec: 30 },
  { label: '1 minute', ttlSec: 60 },
  { label: '5 minutes', ttlSec: 300 },
] as const;

export function isEphemeralContent(content: { kind: string; ephemeral?: EphemeralMedia }): boolean {
  if (content.kind === 'text') return false;
  return Boolean(content.ephemeral);
}

export function ephemeralSecondsRemaining(
  ephemeral: EphemeralMedia,
  messageTimestamp: number,
  now = Date.now(),
): number {
  const remainingMs = messageTimestamp + ephemeral.ttlSec * 1000 - now;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function formatEphemeralCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return String(seconds);
}
