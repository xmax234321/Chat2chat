const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** Round timestamp down to 5-minute boundary for server-visible metadata. */
export function roundTimestampForServer(exactMs: number): number {
  return Math.floor(exactMs / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
}
