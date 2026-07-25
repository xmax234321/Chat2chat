import type { PickedMedia, SendQuality } from './pick-media';

/** Ask full vs compressed only when the batch is at least this large. */
export const ASK_SEND_QUALITY_MIN_BYTES = 8 * 1024 * 1024;

export function estimatedPickBytes(picked: PickedMedia): number {
  if (picked.data?.length) return picked.data.length;
  if (picked.nativeSize) return picked.nativeSize;
  return 0;
}

export function shouldAskSendQuality(items: PickedMedia[]): boolean {
  let total = 0;
  for (const item of items) {
    total += estimatedPickBytes(item);
    if (total >= ASK_SEND_QUALITY_MIN_BYTES) return true;
  }
  return false;
}

export function defaultSendQualityForBatch(items: PickedMedia[]): SendQuality {
  return shouldAskSendQuality(items) ? 'compressed' : 'full';
}
