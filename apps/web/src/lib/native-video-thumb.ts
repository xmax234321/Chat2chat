import { Capacitor } from '@capacitor/core';
import { isCapacitor } from './platform';

export async function createNativeVideoThumbUrl(
  path: string,
  options?: { maxSize?: number; timeSec?: number },
): Promise<string | undefined> {
  if (!isCapacitor()) return undefined;
  const normalized = path.replace(/^file:\/\//, '');
  try {
    const { PhotoGallery } = await import('./native-photo-gallery');
    const result = await PhotoGallery.videoThumbnail({
      path: normalized,
      maxSize: options?.maxSize ?? 720,
      timeSec: options?.timeSec ?? 1,
    });
    const thumbPath = result.path.replace(/^file:\/\//, '');
    return Capacitor.convertFileSrc(thumbPath);
  } catch {
    return undefined;
  }
}

export async function createNativeVideoThumbFromMessage(
  messageId: string,
): Promise<string | undefined> {
  const { readCachedNativeRef } = await import('./media-cache');
  const native = await readCachedNativeRef(messageId);
  if (native?.uri) {
    return createNativeVideoThumbUrl(native.uri);
  }
  return undefined;
}
