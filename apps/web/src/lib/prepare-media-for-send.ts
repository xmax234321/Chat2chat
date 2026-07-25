import type { PickedMedia, SendQuality } from './pick-media';
import { normalizeVideoMime } from './pick-media';
import { defaultFileName } from './media-file';
import { readNativePickBytes } from './read-native-file';
import { isCapacitor } from './platform';

const LOSSLESS_IMAGE_MIMES = new Set(['image/png', 'image/gif', 'image/webp']);
const CONVERT_TO_JPEG_MIMES = new Set(['image/heic', 'image/heif']);
const MAX_IMAGE_DIM = 2048;
const JPEG_QUALITY = 0.88;
const MAX_RAW_BYTES = 2_500_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image on device'));
    img.src = url;
  });
}

async function canvasEncodeJpeg(
  url: string,
  fileName = 'photo.jpg',
): Promise<{ data: Uint8Array; mime: string; fileName: string }> {
  const img = await loadImage(url);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (!width || !height) {
    throw new Error('Invalid image dimensions');
  }

  if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
    const scale = MAX_IMAGE_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  const data = new Uint8Array(await blob.arrayBuffer());
  if (!data.length) throw new Error('Encoded image is empty');
  return { data, mime: 'image/jpeg', fileName };
}

async function canvasEncode(
  url: string,
  mime: string,
): Promise<{ data: Uint8Array; mime: string; fileName: string }> {
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return canvasEncodeJpeg(url);
  }
  if (LOSSLESS_IMAGE_MIMES.has(mime)) {
    const img = await loadImage(url);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    const needsResize = width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM;
    if (!needsResize && mime === 'image/gif') {
      throw new Error('use-raw');
    }
    if (!needsResize) {
      throw new Error('use-raw');
    }
    return canvasEncodeJpeg(url, defaultFileName('image/jpeg'));
  }
  return canvasEncodeJpeg(url);
}

/** Re-encode image on-device before encryption (resize / convert when needed). */
export async function prepareImageForSend(
  picked: PickedMedia,
  quality: SendQuality = picked.sendQuality ?? 'compressed',
): Promise<{ data: Uint8Array; mime: string; fileName: string }> {
  const mime = picked.mime.toLowerCase();

  if (!picked.data?.length && picked.file.size > 0 && !picked.nativePath) {
    const fromFile = new Uint8Array(await picked.file.arrayBuffer());
    if (fromFile.length) {
      return prepareImageForSend({ ...picked, data: fromFile, nativePath: undefined }, quality);
    }
  }

  if (quality === 'full') {
    if (picked.data?.length) {
      return {
        data: picked.data,
        mime,
        fileName: picked.file.name?.trim() || defaultFileName(mime),
      };
    }
    if (picked.nativePath) {
      const data = await readNativePickBytes(picked.nativePath, { expectedSize: picked.nativeSize });
      if (!data.length) throw new Error('Could not read image');
      return {
        data,
        mime,
        fileName: picked.file.name?.trim() || defaultFileName(mime),
      };
    }
    throw new Error('No image to prepare');
  }
  const needsResize = (picked.data?.length ?? 0) > MAX_RAW_BYTES;
  const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg';

  if (picked.data?.length && isJpeg && !needsResize) {
    return { data: picked.data, mime: 'image/jpeg', fileName: defaultFileName('image/jpeg') };
  }

  if (picked.data?.length && LOSSLESS_IMAGE_MIMES.has(mime) && !needsResize) {
    return {
      data: picked.data,
      mime,
      fileName: picked.file.name?.trim() || defaultFileName(mime),
    };
  }

  if (picked.data?.length && CONVERT_TO_JPEG_MIMES.has(mime)) {
    const url =
      picked.previewUrl ??
      URL.createObjectURL(new Blob([Uint8Array.from(picked.data)], { type: mime }));
    const ownsUrl = !picked.previewUrl;
    try {
      return await canvasEncodeJpeg(url);
    } catch {
      return {
        data: picked.data,
        mime,
        fileName: picked.file.name?.trim() || defaultFileName(mime),
      };
    } finally {
      if (ownsUrl) URL.revokeObjectURL(url);
    }
  }

  if (picked.data?.length && !needsResize && !CONVERT_TO_JPEG_MIMES.has(mime)) {
    return {
      data: picked.data,
      mime,
      fileName: picked.file.name?.trim() || defaultFileName(mime),
    };
  }

  if (!picked.data?.length && picked.nativePath) {
    const data = await readNativePickBytes(picked.nativePath, { expectedSize: picked.nativeSize });
    if (!data.length) throw new Error('Could not read image');
    return prepareImageForSend({ ...picked, data });
  }

  const url =
    picked.previewUrl ??
    (picked.data
      ? URL.createObjectURL(new Blob([Uint8Array.from(picked.data)], { type: mime }))
      : null);
  if (!url) throw new Error('No image to prepare');

  const ownsUrl = !picked.previewUrl;
  try {
    try {
      return await canvasEncode(url, mime);
    } catch (e) {
      if (e instanceof Error && e.message === 'use-raw' && picked.data?.length) {
        return {
          data: picked.data,
          mime,
          fileName: picked.file.name?.trim() || defaultFileName(mime),
        };
      }
      throw e;
    }
  } finally {
    if (ownsUrl) URL.revokeObjectURL(url);
  }
}

export function isVideoPick(picked: PickedMedia): boolean {
  return !picked.isFile && picked.mime.startsWith('video/');
}

export function isFilePick(picked: PickedMedia): boolean {
  return Boolean(picked.isFile);
}

export function isVoicePick(picked: PickedMedia): boolean {
  return Boolean(picked.isVoice);
}

/** Compress (on iOS), then read video bytes with optional progress callbacks. */
export async function prepareVideoForSend(
  picked: PickedMedia,
  onProgress?: (pct: number) => void,
  quality: SendQuality = picked.sendQuality ?? 'compressed',
): Promise<{ data: Uint8Array; mime: string; fileName: string }> {
  const fileName = picked.file.name?.trim() || defaultFileName('video/mp4');
  let mime = normalizeVideoMime(picked.mime, fileName);
  let nativePath = picked.nativePath?.replace(/^file:\/\//, '');

  onProgress?.(2);

  if (nativePath && isCapacitor() && quality === 'compressed') {
    try {
      onProgress?.(4);
      const { PhotoGallery } = await import('./native-photo-gallery');
      const compressed = await PhotoGallery.compressVideo({ path: nativePath });
      nativePath = compressed.path.replace(/^file:\/\//, '');
      mime = compressed.mime || mime;
      onProgress?.(12);
    } catch {
      onProgress?.(8);
    }
  }

  if (picked.data?.length) {
    onProgress?.(20);
    return { data: picked.data, mime, fileName };
  }

  if (nativePath) {
    onProgress?.(14);
    try {
      const data = await readNativePickBytes(nativePath, {
        expectedSize: picked.nativeSize,
        onProgress: (readPct) => onProgress?.(14 + Math.round(readPct * 0.12)),
      });
      if (!data.length) throw new Error('Video file is empty');
      onProgress?.(26);
      return { data, mime, fileName };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not read video';
      throw new Error(msg.includes('read') ? msg : `Could not read video: ${msg}`);
    }
  }

  throw new Error('Could not read video');
}

/** Read file bytes for send — defers heavy reads until after the bubble is visible. */
export async function prepareFileForSend(
  picked: PickedMedia,
  onProgress?: (pct: number) => void,
): Promise<{ data: Uint8Array; mime: string; fileName: string }> {
  const fileName = picked.file.name?.trim() || 'file.bin';
  const mime =
    picked.mime === 'application/octet-stream' ? 'application/octet-stream' : picked.mime;

  if (picked.data?.length) {
    onProgress?.(20);
    return { data: picked.data, mime, fileName };
  }

  if (picked.nativePath) {
    onProgress?.(4);
    const data = await readNativePickBytes(picked.nativePath, {
      expectedSize: picked.nativeSize,
      onProgress: (readPct) => onProgress?.(4 + Math.round(readPct * 0.2)),
    });
    if (!data.length) throw new Error('Could not read file');
    onProgress?.(24);
    return { data, mime, fileName };
  }

  throw new Error('Could not read file');
}
