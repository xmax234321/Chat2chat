import type { EphemeralMedia } from './ephemeral-media';
import type { GalleryAssetInfo } from './native-photo-gallery';
import type { PickedMedia, SendQuality } from './pick-media';
import { Capacitor } from '@capacitor/core';
import { isCapacitor } from './platform';
import { pickAndValidateMediaFile } from './pick-media';
import { createNativeVideoThumbUrl } from './native-video-thumb';
import { isVideoFramePreview } from './media-thumbnail';
import { pickedFromNativeLightweight, shouldDeferNativeBytes } from './pick-ios-lightweight';
import { readNativePickBytes } from './read-native-file';
import { normalizeVideoMime } from './pick-media';

export type GalleryTab = 'photos' | 'videos';

export type GallerySelectionItem =
  | { kind: 'native'; asset: GalleryAssetInfo; thumbUrl?: string }
  | { kind: 'web'; picked: PickedMedia; thumbUrl: string; clientId: string };

export function galleryItemKey(item: GallerySelectionItem): string {
  return item.kind === 'native' ? item.asset.id : item.clientId;
}

export type GalleryPreparedItem = {
  media: PickedMedia;
  caption: string;
  ephemeral: EphemeralMedia | null;
  sendQuality?: SendQuality;
};

function nativePlayUrl(path: string): string {
  return Capacitor.convertFileSrc(path.replace(/^file:\/\//, ''));
}

export type GalleryPermissionStatus = import('./native-photo-gallery').GalleryPermissionStatus;

export function isGalleryPermissionGranted(status: GalleryPermissionStatus): boolean {
  return status === 'authorized' || status === 'limited';
}

export async function readGalleryPermissionStatus(): Promise<GalleryPermissionStatus> {
  if (!isCapacitor()) return 'authorized';
  try {
    const { PhotoGallery } = await import('./native-photo-gallery');
    const result = await PhotoGallery.galleryAuthorizationStatus();
    const status = result?.status;
    if (
      status === 'authorized' ||
      status === 'limited' ||
      status === 'denied' ||
      status === 'restricted' ||
      status === 'not_determined'
    ) {
      return status;
    }
    return 'denied';
  } catch {
    return 'denied';
  }
}

export async function requestGalleryPermission(): Promise<GalleryPermissionStatus> {
  if (!isCapacitor()) return 'authorized';
  const { PhotoGallery } = await import('./native-photo-gallery');
  const { status } = await PhotoGallery.requestGalleryAuthorization();
  return status;
}

export async function openGalleryAppSettings(): Promise<void> {
  if (!isCapacitor()) return;
  const { PhotoGallery } = await import('./native-photo-gallery');
  await PhotoGallery.openAppSettings();
}

export async function listGalleryAssets(
  tab: GalleryTab,
  offset = 0,
  limit = 360,
): Promise<{ assets: GalleryAssetInfo[]; total: number }> {
  if (!isCapacitor()) return { assets: [], total: 0 };
  const { PhotoGallery } = await import('./native-photo-gallery');
  return PhotoGallery.listGalleryAssets({
    filter: tab === 'photos' ? 'photos' : 'videos',
    offset,
    limit,
  });
}

export async function loadGalleryThumbnail(assetId: string, size = 240): Promise<string> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  const { path, mime } = await PhotoGallery.galleryThumbnail({ id: assetId, size });
  const data = await readNativePickBytes(path);
  return URL.createObjectURL(new Blob([data.slice()], { type: mime }));
}

export async function exportGallerySelection(items: GallerySelectionItem[]): Promise<PickedMedia[]> {
  const nativeIds = items.filter((i): i is Extract<GallerySelectionItem, { kind: 'native' }> => i.kind === 'native')
    .map((i) => i.asset.id);

  const webItems = items.filter((i): i is Extract<GallerySelectionItem, { kind: 'web' }> => i.kind === 'web')
    .map((i) => i.picked);

  const results: PickedMedia[] = [...webItems];

  if (nativeIds.length && isCapacitor()) {
    const { PhotoGallery } = await import('./native-photo-gallery');
    const batch = await PhotoGallery.exportGalleryAssets({ ids: nativeIds });
    for (const picked of batch.items) {
      const isVideo = picked.mime.startsWith('video/');
      const defer = shouldDeferNativeBytes(picked, isVideo, false);
      let media = defer
        ? pickedFromNativeLightweight(picked, {
            isVideo,
            defaultName: picked.fileName || (isVideo ? 'video.mov' : 'photo.jpg'),
          })
        : await (async () => {
            const data = await readNativePickBytes(picked.path, { expectedSize: picked.size });
            const mime = isVideo ? normalizeVideoMime(picked.mime, picked.fileName) : picked.mime || 'image/jpeg';
            const previewUrl = URL.createObjectURL(new Blob([data.slice()], { type: mime }));
            return {
              file: new File([data.slice()], picked.fileName || 'media', { type: mime }),
              mime,
              data,
              previewUrl,
            } satisfies PickedMedia;
          })();

      if (isVideo && !media.previewUrl) {
        const thumb = await createNativeVideoThumbUrl(picked.path.replace(/^file:\/\//, ''));
        if (thumb && isVideoFramePreview(thumb)) {
          media = { ...media, previewUrl: thumb };
        }
      }
      results.push(media);
    }
  }

  return results;
}

export async function loadGalleryDetailPreview(item: GallerySelectionItem): Promise<string> {
  if (item.kind === 'web') {
    if (item.picked.mime.startsWith('video/')) {
      if (item.picked.nativePath) return nativePlayUrl(item.picked.nativePath);
      return item.picked.previewUrl ?? item.thumbUrl ?? '';
    }
    return item.picked.previewUrl ?? item.thumbUrl ?? '';
  }
  if (item.asset.mediaType === 'video') {
    if (!isCapacitor()) return item.thumbUrl ?? '';
    const { PhotoGallery } = await import('./native-photo-gallery');
    const batch = await PhotoGallery.exportGalleryAssets({ ids: [item.asset.id] });
    const picked = batch.items[0];
    if (!picked?.path) return item.thumbUrl ?? '';
    return nativePlayUrl(picked.path);
  }
  const url = await loadGalleryThumbnail(item.asset.id, 1600);
  return url || item.thumbUrl || '';
}

export async function pickedFromWebFiles(files: File[]): Promise<PickedMedia[]> {
  const items: PickedMedia[] = [];
  for (const file of files) {
    items.push(await pickAndValidateMediaFile(file));
  }
  return items;
}

export function galleryItemFileName(item: GallerySelectionItem): string {
  if (item.kind === 'web') {
    return item.picked.file.name?.trim() || 'photo.jpg';
  }
  const idPart = item.asset.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'photo';
  return `IMG_${idPart}.jpg`;
}

export function editedGalleryFileName(sourceName: string, mime: string): string {
  const base = (sourceName.trim() || 'photo').replace(/\.[^.]+$/, '');
  if (mime.includes('png')) return `${base}.png`;
  if (mime.includes('heic') || mime.includes('heif')) return `${base}.heic`;
  if (mime.includes('webp')) return `${base}.webp`;
  return `${base}.jpg`;
}

export function webGalleryItem(picked: PickedMedia, clientId?: string): Extract<GallerySelectionItem, { kind: 'web' }> {
  return {
    kind: 'web',
    picked,
    thumbUrl: picked.previewUrl ?? '',
    clientId: clientId ?? `web-${picked.nativePath ?? picked.file.name}-${Date.now()}`,
  };
}
