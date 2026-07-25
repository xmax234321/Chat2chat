import type { PickedMedia } from './pick-media';
import { Capacitor } from '@capacitor/core';
import { isCapacitor } from './platform';
import {
  createFullImageBlobUrl,
  createMediaPreviewUrl,
  createVideoBubbleThumbFromUrl,
  createVideoBubbleThumbUrl,
  visualMediaKind,
} from './media-thumbnail';
import { createNativeVideoThumbUrl } from './native-video-thumb';

function nativePreviewUrl(path: string): string {
  const normalized = path.replace(/^file:\/\//, '');
  return Capacitor.convertFileSrc(normalized);
}

/** Instant preview for outgoing bubble — no canvas/video decode. */
export function quickPreviewForSend(
  picked: PickedMedia,
  isFile: boolean,
  isVideo: boolean,
  isVoice = false,
): string | undefined {
  if (picked.previewUrl) return picked.previewUrl;

  if (picked.nativePath) {
    if (isVideo) return nativePreviewUrl(picked.nativePath);
    if (!isFile) return nativePreviewUrl(picked.nativePath);
    if (visualMediaKind(picked.mime, picked.file.name) === 'image') {
      return nativePreviewUrl(picked.nativePath);
    }
  }

  if (!picked.data?.length) return undefined;

  if (isVoice) {
    return URL.createObjectURL(new Blob([picked.data.slice()], { type: picked.mime }));
  }

  if (!isFile && !isVideo) {
    return createFullImageBlobUrl(picked.data, picked.mime);
  }

  if (isVideo) {
    return URL.createObjectURL(new Blob([picked.data.slice()], { type: picked.mime }));
  }

  if (visualMediaKind(picked.mime, picked.file.name) === 'image') {
    return createFullImageBlobUrl(picked.data, picked.mime);
  }

  return undefined;
}

/** Higher-quality thumb/file art — runs after the message is already visible. */
export async function enrichOutgoingPreview(
  picked: PickedMedia,
  isFile: boolean,
  isVideo: boolean,
): Promise<string | undefined> {
  if (isVideo) {
    if (picked.nativePath && isCapacitor()) {
      const thumb = await createNativeVideoThumbUrl(picked.nativePath.replace(/^file:\/\//, ''));
      if (thumb) return thumb;
      return createVideoBubbleThumbFromUrl(nativePreviewUrl(picked.nativePath), picked.file.name, picked.nativePath);
    }
    if (picked.data?.length) {
      return createVideoBubbleThumbUrl(picked.data, picked.mime, picked.file.name);
    }
    if (picked.previewUrl && !picked.previewUrl.startsWith('data:image/png')) {
      return createVideoBubbleThumbFromUrl(picked.previewUrl, picked.file.name);
    }
    return undefined;
  }

  const data = picked.data;

  if (isFile) {
    if (visualMediaKind(picked.mime, picked.file.name) === 'image') {
      if (data?.length) return createFullImageBlobUrl(data, picked.mime);
      if (picked.nativePath) return nativePreviewUrl(picked.nativePath);
    }
    if (data?.length) {
      return createMediaPreviewUrl(data, picked.mime, picked.file.name);
    }
    return undefined;
  }

  if (!data?.length) return undefined;

  return createFullImageBlobUrl(data, picked.mime);
}
