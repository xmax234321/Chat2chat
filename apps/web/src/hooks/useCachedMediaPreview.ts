import { useEffect, useState } from 'react';
import {
  mediaCacheRevision,
  normalizePlaybackMime,
  readCachedMediaBytes,
  readCachedNativeRef,
  subscribeMediaCacheUpdates,
} from '../lib/media-cache';
import { isCapacitor } from '../lib/platform';
import {
  createFullImageBlobUrl,
  createInstantVideoThumbUrl,
  createVideoBubbleThumbFromUrl,
  createVideoBubbleThumbUrl,
  isVideoFramePreview,
} from '../lib/media-thumbnail';
import { createNativeVideoThumbFromMessage, createNativeVideoThumbUrl } from '../lib/native-video-thumb';
import { persistVideoThumbPreview, readCachedVideoThumbUrl, subscribeVideoThumbCacheUpdates, videoThumbCacheRevision } from '../lib/video-thumb-cache';

export type BubbleMediaSources = {
  thumbSrc: string;
  playSrc: string;
};

const VIDEO_THUMB_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

async function resolveVideoPlayUrl(
  messageId: string,
  mime: string | undefined,
): Promise<{ playUrl: string; fsPath?: string; revoke: boolean } | null> {
  const playMime = normalizePlaybackMime(mime ?? 'video/mp4');

  if (isCapacitor()) {
    const native = await readCachedNativeRef(messageId);
    if (native?.uri) {
      const { Capacitor } = await import('@capacitor/core');
      const fsPath = native.uri.replace(/^file:\/\//, '');
      return { playUrl: Capacitor.convertFileSrc(fsPath), fsPath, revoke: false };
    }
  }

  const cached = await readCachedMediaBytes(messageId);
  if (cached?.data.length) {
    const mediaMime = normalizePlaybackMime(cached.mime || mime || playMime);
    return {
      playUrl: URL.createObjectURL(new Blob([cached.data.slice()], { type: mediaMime })),
      revoke: true,
    };
  }

  return null;
}

/** Restore chat bubble previews from local cache; keep full quality for images. */
export function useBubbleMediaSources(
  messageId: string,
  previewUrl: string | undefined,
  fileName: string,
  mime: string | undefined,
  displayKind: 'image' | 'video' | 'file',
  uploading = false,
): BubbleMediaSources {
  const instantVideoThumb =
    displayKind === 'video' && !isVideoFramePreview(previewUrl)
      ? createInstantVideoThumbUrl(fileName)
      : '';
  const [thumbSrc, setThumbSrc] = useState(
    isVideoFramePreview(previewUrl) ? previewUrl! : previewUrl || instantVideoThumb,
  );
  const [playSrc, setPlaySrc] = useState(previewUrl ?? '');
  const [cacheTick, setCacheTick] = useState(mediaCacheRevision);
  const [thumbTick, setThumbTick] = useState(videoThumbCacheRevision);

  useEffect(() => subscribeMediaCacheUpdates(() => setCacheTick(mediaCacheRevision())), []);
  useEffect(() => subscribeVideoThumbCacheUpdates(() => setThumbTick(videoThumbCacheRevision())), []);

  useEffect(() => {
    if (displayKind !== 'image' && displayKind !== 'video') return;

    let thumbRevoke: string | null = null;
    let playRevoke: string | null = null;
    let cancelled = false;

    const apply = (thumb: string, play: string) => {
      if (cancelled || !thumb || !play) return;
      setThumbSrc(thumb);
      setPlaySrc(play);
    };

    void (async () => {
      if (displayKind === 'image') {
        const cached = await readCachedMediaBytes(messageId);
        const data = cached?.data;
        const mediaMime = cached?.mime || mime || 'application/octet-stream';

        if (data?.length) {
          const url = createFullImageBlobUrl(data, mediaMime);
          playRevoke = url;
          thumbRevoke = url;
          apply(url, url);
          return;
        }
        if (previewUrl) apply(previewUrl, previewUrl);
        return;
      }

      const instantThumb = createInstantVideoThumbUrl(fileName);

      const cachedThumb = await readCachedVideoThumbUrl(messageId);
      if (cancelled) return;
      if (cachedThumb) {
        const playEarly = await resolveVideoPlayUrl(messageId, mime);
        if (cancelled) return;
        if (playEarly) {
          if (playEarly.revoke) playRevoke = playEarly.playUrl;
          apply(cachedThumb, playEarly.playUrl);
        } else {
          apply(cachedThumb, cachedThumb);
        }
        if (cachedThumb.startsWith('blob:')) thumbRevoke = cachedThumb;
        return;
      }

      apply(instantThumb, instantThumb);

      let thumb: string | undefined;

      if (isCapacitor()) {
        thumb = await withTimeout(createNativeVideoThumbFromMessage(messageId), VIDEO_THUMB_TIMEOUT_MS);
      }

      const play = await resolveVideoPlayUrl(messageId, mime);
      if (cancelled) return;

      if (!thumb && play?.fsPath) {
        thumb = await withTimeout(createNativeVideoThumbUrl(play.fsPath), VIDEO_THUMB_TIMEOUT_MS);
      }

      if (!thumb || !isVideoFramePreview(thumb)) {
        const cached = await readCachedMediaBytes(messageId);
        if (cached?.data.length) {
          thumb = await withTimeout(
            createVideoBubbleThumbUrl(cached.data, cached.mime || mime || 'video/mp4', fileName),
            VIDEO_THUMB_TIMEOUT_MS,
          );
        }
      }

      if ((!thumb || !isVideoFramePreview(thumb)) && play) {
        thumb = await withTimeout(
          createVideoBubbleThumbFromUrl(play.playUrl, fileName, play.fsPath),
          VIDEO_THUMB_TIMEOUT_MS,
        );
      }

      if (isVideoFramePreview(previewUrl) && play) {
        void persistVideoThumbPreview(messageId, previewUrl);
        apply(previewUrl!, play.playUrl);
        if (play.revoke) playRevoke = play.playUrl;
        return;
      }

      if (!play) {
        if (thumb && isVideoFramePreview(thumb)) {
          if (thumb.startsWith('blob:')) thumbRevoke = thumb;
          void persistVideoThumbPreview(messageId, thumb);
          apply(thumb, thumb);
        }
        return;
      }

      if (play.revoke) playRevoke = play.playUrl;

      if (thumb && isVideoFramePreview(thumb)) {
        if (thumb.startsWith('blob:')) thumbRevoke = thumb;
        void persistVideoThumbPreview(messageId, thumb);
        apply(thumb, play.playUrl);
        return;
      }

      apply(instantThumb, play.playUrl);
    })();

    return () => {
      cancelled = true;
      if (thumbRevoke && thumbRevoke !== playRevoke) URL.revokeObjectURL(thumbRevoke);
      if (playRevoke) URL.revokeObjectURL(playRevoke);
    };
  }, [messageId, previewUrl, fileName, mime, displayKind, uploading, cacheTick, thumbTick]);

  return { thumbSrc, playSrc };
}

/** @deprecated use useBubbleMediaSources */
export function useCachedMediaPreview(
  messageId: string,
  previewUrl: string | undefined,
  fileName: string,
  mime: string | undefined,
  enabled: boolean,
): string {
  const kind = enabled ? (mime?.startsWith('video/') ? 'video' : 'image') : 'file';
  const displayKind = kind === 'video' ? 'video' : kind === 'image' ? 'image' : 'file';
  const { thumbSrc } = useBubbleMediaSources(messageId, previewUrl, fileName, mime, displayKind);
  return thumbSrc;
}
