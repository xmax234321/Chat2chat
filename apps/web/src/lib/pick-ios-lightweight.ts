import { Capacitor } from '@capacitor/core';
import type { PickedMedia } from './pick-media';
import { normalizeVideoMime } from './pick-media';
import { createInstantVideoThumbUrl } from './media-thumbnail';
import type { NativePickResult } from './native-photo-gallery';

function nativePreviewUrl(path: string): string {
  const normalized = path.replace(/^file:\/\//, '');
  return Capacitor.convertFileSrc(normalized);
}

function pickedMeta(
  picked: NativePickResult,
  options: { isVideo?: boolean; isFile?: boolean; defaultName: string },
) {
  const isFile = Boolean(picked.isFile || options.isFile);
  const isVideo = !isFile && (options.isVideo || picked.mime.startsWith('video/'));
  const mime = isFile
    ? picked.mime || 'application/octet-stream'
    : isVideo
      ? normalizeVideoMime(picked.mime, picked.fileName)
      : picked.mime || 'image/jpeg';
  const name = picked.fileName || options.defaultName;
  return { isFile, isVideo, mime, name };
}

/** Metadata only — no byte read. Ephemeral sheet can open immediately after picker. */
export function pickedFromNativeLightweight(
  picked: NativePickResult,
  options: { isVideo?: boolean; isFile?: boolean; defaultName: string },
): PickedMedia {
  const { isFile, isVideo, mime, name } = pickedMeta(picked, options);
  const previewUrl = isVideo
    ? createInstantVideoThumbUrl(name)
    : isFile
      ? undefined
      : nativePreviewUrl(picked.path);

  return {
    file: new File([], name, { type: mime }),
    mime,
    nativePath: picked.path,
    nativeSize: picked.size,
    previewUrl,
    isFile,
  };
}

export function shouldDeferNativeBytes(picked: NativePickResult, isVideo: boolean, isFile: boolean): boolean {
  if (isVideo) return true;
  if (isFile) return (picked.size ?? 0) > 4 * 1024 * 1024;
  return (picked.size ?? 0) > 6 * 1024 * 1024;
}
