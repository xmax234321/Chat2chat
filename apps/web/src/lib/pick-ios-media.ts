import type { PickedMedia } from './pick-media';
import { normalizeVideoMime } from './pick-media';
import { isCapacitor } from './platform';
import { readNativePickBytes } from './read-native-file';
import type { NativePickBatchResult, NativePickResult } from './native-photo-gallery';
import { createFullImageBlobUrl, isVideoFramePreview, visualMediaKind } from './media-thumbnail';
import { pickedFromNativeLightweight, shouldDeferNativeBytes } from './pick-ios-lightweight';
import { createNativeVideoThumbUrl } from './native-video-thumb';

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isUserCancelled(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /^(user cancelled|cancelled|cancel)$/i.test(msg.trim()) || /user cancelled|user canceled/i.test(msg);
}

export function isNativePickerUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /not implemented|unimplemented|unavailable|native picker unavailable/i.test(msg);
}

export { isUserCancelled };

async function pickedFromNative(
  picked: NativePickResult,
  options: { isVideo?: boolean; isFile?: boolean; defaultName: string },
): Promise<PickedMedia> {
  const isFile = Boolean(picked.isFile || options.isFile);
  const isVideo = !isFile && (options.isVideo || picked.mime.startsWith('video/'));
  const mime = isFile
    ? picked.mime || 'application/octet-stream'
    : isVideo
      ? normalizeVideoMime(picked.mime, picked.fileName)
      : picked.mime || 'image/jpeg';
  const name = picked.fileName || options.defaultName;

  const data = await readNativePickBytes(picked.path, { expectedSize: picked.size });
  const previewUrl = isFile
    ? visualMediaKind(mime, name) === 'image'
      ? createFullImageBlobUrl(data, mime)
      : undefined
    : isVideo
      ? URL.createObjectURL(new Blob([data.slice()], { type: mime }))
      : URL.createObjectURL(new Blob([data.slice()], { type: mime }));

  return {
    file: new File([data.slice()], name, { type: mime }),
    mime,
    data,
    previewUrl,
    isFile,
  };
}

async function finalizePickedMedia(
  media: PickedMedia,
  options: { isFile?: boolean },
): Promise<PickedMedia> {
  if (!options.isFile && media.mime.startsWith('video/') && !media.previewUrl && media.data) {
    return {
      ...media,
      previewUrl: URL.createObjectURL(new Blob([media.data.slice()], { type: media.mime })),
    };
  }
  return media;
}

async function runNativeMultiPick(
  pick: () => Promise<NativePickBatchResult>,
  options: { isVideo?: boolean; isFile?: boolean; defaultName: string; openError: string },
): Promise<PickedMedia[]> {
  if (!isCapacitor()) {
    throw new Error('Native picker unavailable');
  }

  let batch: NativePickBatchResult;
  try {
    batch = await pick();
  } catch (e) {
    if (isUserCancelled(e)) throw e;
    if (isNativePickerUnavailable(e)) throw new Error('Native picker unavailable');
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg || options.openError);
  }

  const results: PickedMedia[] = [];
  let lastError: unknown;
  for (const picked of batch.items) {
    try {
      const defer = shouldDeferNativeBytes(picked, Boolean(options.isVideo), Boolean(options.isFile));
      let media = defer
        ? pickedFromNativeLightweight(picked, options)
        : await pickedFromNative(picked, options);
      if (defer && !options.isFile && (options.isVideo || picked.mime.startsWith('video/'))) {
        const thumb = await createNativeVideoThumbUrl(picked.path.replace(/^file:\/\//, ''));
        if (thumb && isVideoFramePreview(thumb)) {
          media = { ...media, previewUrl: thumb };
        }
      }
      results.push(await finalizePickedMedia(media, options));
    } catch (e) {
      lastError = e;
      console.warn('[pick-ios] item failed:', e);
    }
  }

  if (!results.length) {
    const msg = lastError instanceof Error ? lastError.message : 'Could not read file';
    throw new Error(msg || 'Could not read file');
  }

  return results;
}

/** Native iOS gallery — photos and videos in one picker. */
export async function pickIosGalleryMedia(): Promise<PickedMedia[]> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  return runNativeMultiPick(() => PhotoGallery.pickMedia(), {
    isVideo: false,
    defaultName: 'media.jpg',
    openError: 'Could not open photo library',
  });
}

/** Native iOS gallery photo picker (PHPicker). */
export async function pickIosGalleryPhoto(): Promise<PickedMedia[]> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  return runNativeMultiPick(() => PhotoGallery.pickPhoto(), {
    isVideo: false,
    defaultName: 'photo.jpg',
    openError: 'Could not open photo library',
  });
}

/** Native iOS video picker (PHPicker). */
export async function pickIosGalleryVideo(): Promise<PickedMedia[]> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  return runNativeMultiPick(() => PhotoGallery.pickVideo(), {
    isVideo: true,
    defaultName: 'video.mov',
    openError: 'Could not open video library',
  });
}

/** Native iOS document picker. */
export async function pickIosDocument(): Promise<PickedMedia[]> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  return runNativeMultiPick(() => PhotoGallery.pickFile(), {
    isVideo: false,
    isFile: true,
    defaultName: 'file.bin',
    openError: 'Could not open file picker',
  });
}

/** Native camera — photo or video in one capture flow. */
export async function pickCameraMedia(): Promise<PickedMedia> {
  if (!isCapacitor()) {
    throw new Error('Native picker unavailable');
  }

  const { PhotoGallery } = await import('./native-photo-gallery');
  let batch: NativePickBatchResult;
  try {
    batch = await Promise.race([
      PhotoGallery.captureMedia(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Could not open camera')), 15000);
      }),
    ]);
  } catch (e) {
    if (isUserCancelled(e)) throw e;
    if (isNativePickerUnavailable(e)) throw new Error('Native picker unavailable');
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg || 'Could not open camera');
  }

  const picked = batch.items[0];
  if (!picked) throw new Error('Nothing captured');

  const isVideo = picked.mime.startsWith('video/');
  const media = shouldDeferNativeBytes(
    { path: picked.path, mime: picked.mime, fileName: picked.fileName, size: picked.size },
    isVideo,
    false,
  )
    ? pickedFromNativeLightweight(picked, {
        isVideo,
        defaultName: isVideo ? 'video.mov' : 'photo.jpg',
      })
    : await pickedFromNative(picked, {
        isVideo,
        defaultName: isVideo ? 'video.mov' : 'photo.jpg',
      });
  return finalizePickedMedia(media, {});
}

/** Native camera — take a new photo. @deprecated use pickCameraMedia */
export async function pickCameraPhoto(): Promise<PickedMedia> {
  if (!isCapacitor()) {
    throw new Error('Native picker unavailable');
  }

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  let photo;
  try {
    photo = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      saveToGallery: false,
    });
  } catch (e) {
    if (isUserCancelled(e)) throw e;
    throw new Error('Could not open camera');
  }

  let data: Uint8Array;
  if (photo.base64String) {
    data = base64ToBytes(photo.base64String);
  } else if (photo.path) {
    data = await readNativePickBytes(photo.path);
  } else if (photo.webPath) {
    const res = await fetch(photo.webPath);
    if (!res.ok) throw new Error('Could not read photo');
    data = new Uint8Array(await res.arrayBuffer());
  } else {
    throw new Error('Could not read photo');
  }

  const format = (photo.format ?? 'jpeg').toLowerCase();
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';
  const fileName = `photo-${Date.now()}.${ext}`;
  const previewUrl = URL.createObjectURL(new Blob([data.slice()], { type: mime }));

  return {
    file: new File([data.slice()], fileName, { type: mime }),
    mime,
    data,
    previewUrl,
  };
}
