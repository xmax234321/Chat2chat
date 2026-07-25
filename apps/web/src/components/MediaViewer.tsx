import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackIcon, SaveIcon } from './Icons';
import { EphemeralCountdownBadge } from '../hooks/useEphemeralCountdown';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import { isEphemeralContent } from '../lib/ephemeral-media';
import { MediaViewerVideo } from './MediaViewerVideo';
import { ShareContactSheet } from './ShareContactSheet';
import { useImageZoom } from '../hooks/useImageZoom';
import { saveMediaToGallery, shareMediaFile } from '../lib/save-media';
import { useToast } from './Toast';
import { useApp } from '../store/AppContext';
import { readCachedMediaBytes, readCachedNativeRef, normalizePlaybackMime } from '../lib/media-cache';
import { openNativeDocumentForMessage } from '../lib/open-office-document';
import { isIosCapacitor } from '../lib/platform';
import { FileViewerStage, fileViewerModeFor } from './FileViewerStage';
import type { PickedMedia } from '../lib/pick-media';
import { contactDisplayName } from '../lib/types';

async function blobFromSrc(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not load media');
  return res.blob();
}

export function MediaViewer({
  open,
  kind,
  src,
  fileName,
  mime,
  messageId,
  contactId,
  title,
  subtitle,
  ephemeral,
  messageTimestamp = Date.now(),
  onClose,
  onSwipePrev,
  onSwipeNext,
  hasPrev = false,
  hasNext = false,
  albumPosition,
}: {
  open: boolean;
  kind: 'image' | 'video' | 'file';
  src: string;
  fileName?: string;
  mime?: string;
  messageId: string;
  contactId: string;
  title?: string;
  subtitle?: string;
  ephemeral?: EphemeralMedia | null;
  messageTimestamp?: number;
  onClose: () => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  albumPosition?: string;
}) {
  const isEphemeral = isEphemeralContent({ kind, ephemeral: ephemeral ?? undefined });
  const { show } = useToast();
  const { contacts, groups, sendMedia } = useApp();
  const [chrome, setChrome] = useState(true);
  const [dismissY, setDismissY] = useState(0);
  const [slideX, setSlideX] = useState(0);
  const [slideSmooth, setSlideSmooth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [videoSrc, setVideoSrc] = useState(src);
  const fileMode = kind === 'file' ? fileViewerModeFor(mime, fileName ?? 'file') : null;
  const scrollableFile =
    kind === 'file' &&
    fileMode != null &&
    ['pdf', 'text', 'document', 'preview'].includes(fileMode);
  const swipeRef = useRef<{ x: number; y: number; active: boolean; axis: 'x' | 'y' | null } | null>(null);
  const navDirectionRef = useRef<'prev' | 'next' | null>(null);
  const prevMessageIdRef = useRef(messageId);
  const slideXRef = useRef(0);
  const zoom = useImageZoom(open && kind === 'image');
  const docZoom = useImageZoom(open && scrollableFile);

  useEffect(() => {
    if (!open) return;
    setChrome(true);
    setDismissY(0);
    setSlideX(0);
    setSlideSmooth(false);
    navDirectionRef.current = null;
    prevMessageIdRef.current = messageId;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (prevMessageIdRef.current === messageId) return;
    const direction = navDirectionRef.current;
    prevMessageIdRef.current = messageId;
    navDirectionRef.current = null;
    if (!direction) {
      setSlideX(0);
      return;
    }
    const width = typeof window !== 'undefined' ? window.innerWidth * 0.55 : 200;
    const enterOffset = direction === 'next' ? width : -width;
    setSlideSmooth(false);
    slideXRef.current = enterOffset;
    setSlideX(enterOffset);
    requestAnimationFrame(() => {
      setSlideSmooth(true);
      slideXRef.current = 0;
      setSlideX(0);
    });
  }, [messageId, open]);

  useEffect(() => {
    if (!open || !scrollableFile) return;
    document.documentElement.classList.add('media-viewer-scroll-open');
    document.body.classList.add('media-viewer-scroll-open');
    return () => {
      document.documentElement.classList.remove('media-viewer-scroll-open');
      document.body.classList.remove('media-viewer-scroll-open');
    };
  }, [open, scrollableFile]);

  const stopTouchBubble = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!open || kind !== 'file') return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      if (isIosCapacitor() && fileName) {
        try {
          const opened = await openNativeDocumentForMessage(messageId, fileName);
          if (opened && !cancelled) {
            onClose();
            return;
          }
        } catch {
          /* fall through to web viewer */
        }
      }

      const nativeRef = await readCachedNativeRef(messageId);
      if (cancelled) return;
      if (nativeRef?.uri) {
        const { Capacitor } = await import('@capacitor/core');
        objectUrl = Capacitor.convertFileSrc(nativeRef.uri);
        setFileData(new Uint8Array(0));
        setFileSrc(objectUrl);
        return;
      }

      const entry = await readCachedMediaBytes(messageId);
      if (cancelled) return;
      if (entry?.data.length) {
        objectUrl = URL.createObjectURL(new Blob([entry.data.slice()], { type: mime ?? entry.mime }));
        setFileData(entry.data);
        setFileSrc(objectUrl);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
      setFileSrc(null);
      setFileData(null);
    };
  }, [open, kind, messageId, mime, fileName, onClose]);

  useEffect(() => {
    if (!open || kind !== 'video') return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setVideoSrc(src || '');

    void (async () => {
      if (src) {
        setVideoSrc(src);
      }

      const nativeRef = await readCachedNativeRef(messageId);
      if (!cancelled && nativeRef?.uri) {
        const { Capacitor } = await import('@capacitor/core');
        setVideoSrc(Capacitor.convertFileSrc(nativeRef.uri));
        return;
      }

      const entry = await readCachedMediaBytes(messageId);
      if (cancelled || !entry?.data.length) return;
      const playMime = normalizePlaybackMime(entry.mime || mime || 'video/mp4');
      objectUrl = URL.createObjectURL(new Blob([entry.data.slice()], { type: playMime }));
      setVideoSrc(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, kind, messageId, mime, src]);

  const actionsLocked = isEphemeral;
  const mediaSrc = kind === 'file' ? fileSrc ?? '' : kind === 'video' ? videoSrc : src;

  const toggleChrome = useCallback(() => {
    setChrome((c) => !c);
  }, []);

  const onBackdropClick = useCallback(() => {
    if (kind === 'file' && fileMode && ['pdf', 'text', 'document', 'preview'].includes(fileMode)) {
      return;
    }
    if (kind === 'image' && zoom.scale > 1.05) {
      zoom.resetZoom();
      return;
    }
    toggleChrome();
  }, [kind, fileMode, toggleChrome, zoom]);

  const onSwipeStart = (e: React.TouchEvent) => {
    if (scrollableFile || zoom.scale > 1.05 || docZoom.scale > 1.05 || e.touches.length !== 1) return;
    setSlideSmooth(false);
    swipeRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, active: true, axis: null };
  };

  const commitHorizontalSwipe = (direction: 'prev' | 'next') => {
    const width = typeof window !== 'undefined' ? window.innerWidth * 0.55 : 200;
    const exitOffset = direction === 'prev' ? width : -width;
    slideXRef.current = exitOffset;
    setSlideSmooth(true);
    setSlideX(exitOffset);
    window.setTimeout(() => {
      navDirectionRef.current = direction;
      if (direction === 'prev') onSwipePrev?.();
      else onSwipeNext?.();
    }, 280);
  };

  const onSwipeMove = (e: React.TouchEvent) => {
    if (scrollableFile || !swipeRef.current?.active || e.touches.length !== 1) return;
    const dx = e.touches[0]!.clientX - swipeRef.current.x;
    const dy = e.touches[0]!.clientY - swipeRef.current.y;
    if (!swipeRef.current.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      swipeRef.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (swipeRef.current.axis === 'x') {
      if ((dx > 0 && !hasPrev) || (dx < 0 && !hasNext)) {
        slideXRef.current = dx * 0.25;
        setSlideX(slideXRef.current);
        return;
      }
      slideXRef.current = dx;
      setSlideX(dx);
      return;
    }
    if (dy > 0) setDismissY(dy);
  };

  const onSwipeEnd = () => {
    if (swipeRef.current?.axis === 'x') {
      const offset = slideXRef.current;
      if (offset > 72 && hasPrev) commitHorizontalSwipe('prev');
      else if (offset < -72 && hasNext) commitHorizontalSwipe('next');
      else {
        setSlideSmooth(true);
        slideXRef.current = 0;
        setSlideX(0);
      }
      swipeRef.current = null;
      return;
    }
    if (dismissY > 100) onClose();
    setDismissY(0);
    swipeRef.current = null;
  };

  const resolveMediaBytes = async (): Promise<{ data: Uint8Array; type: string }> => {
    let type = mime ?? 'application/octet-stream';
    const cached = await readCachedMediaBytes(messageId);
    if (cached?.data?.length) {
      return { data: cached.data.slice(), type: cached.mime || type };
    }
    const nativeRef = await readCachedNativeRef(messageId);
    if (nativeRef?.uri) {
      const { Capacitor } = await import('@capacitor/core');
      const nativeSrc = Capacitor.convertFileSrc(nativeRef.uri);
      const blob = await blobFromSrc(nativeSrc);
      return { data: new Uint8Array(await blob.arrayBuffer()), type: nativeRef.mime || mime || blob.type || type };
    }
    const src = kind === 'file' ? fileSrc : mediaSrc;
    if (!src) throw new Error('Media not available');
    const blob = await blobFromSrc(src);
    return { data: new Uint8Array(await blob.arrayBuffer()), type: mime ?? blob.type ?? type };
  };

  const runSave = async () => {
    const src = kind === 'file' ? fileSrc : mediaSrc;
    if (busy || !src) return;
    setBusy(true);
    try {
      if (kind === 'file') {
        await shareMediaFile(src, fileName ?? 'file', mime);
        show('Choose where to save');
      } else {
        await saveMediaToGallery(src, fileName ?? 'media', mime);
        show(kind === 'video' ? 'Saved to gallery' : 'Saved to Photos');
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const runExternalShare = async () => {
    if (busy || !messageId) return;
    setBusy(true);
    try {
      const { data, type } = await resolveMediaBytes();
      const blob = new Blob([data.slice()], { type });
      const url = URL.createObjectURL(blob);
      try {
        await shareMediaFile(url, fileName ?? 'media', type);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setBusy(false);
    }
  };

  const forwardTo = async (targetId: string) => {
    if (busy || !messageId) return;
    setBusy(true);
    try {
      const { data, type } = await resolveMediaBytes();
      const picked: PickedMedia = {
        file: new File([data.slice()], fileName ?? 'media', { type }),
        mime: type,
        data,
        previewUrl: kind === 'file' ? undefined : mediaSrc ?? undefined,
        isFile: kind === 'file',
      };
      await sendMedia(targetId, picked);
      show('Sent');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setBusy(false);
    }
  };

  const shareContactTargets = useMemo(
    () =>
      contacts
        .filter((c) => c.userId !== contactId)
        .map((c) => ({ id: c.userId, name: contactDisplayName(c), avatar: c.avatar })),
    [contacts, contactId],
  );
  const shareGroupTargets = useMemo(
    () =>
      groups
        .filter((g) => g.id !== contactId)
        .map((g) => ({ id: g.id, name: g.name, avatar: g.avatar, isGroup: true as const })),
    [groups, contactId],
  );

  if (!open) return null;

  const dismissProgress = Math.min(1, dismissY / 280);
  const backdropOpacity = Math.max(0.2, 1 - dismissProgress * 0.75);
  const contentScale = Math.max(0.86, 1 - dismissProgress * 0.12);
  const displayTitle = title ?? (kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : 'File');

  const viewer = (
    <div
      className={`media-viewer${scrollableFile ? ' media-viewer-scroll-docs' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={displayTitle}
      style={{ background: `rgba(0, 0, 0, ${backdropOpacity})` }}
      onClick={scrollableFile ? undefined : onBackdropClick}
      onTouchStart={scrollableFile ? undefined : onSwipeStart}
      onTouchMove={scrollableFile ? undefined : onSwipeMove}
      onTouchEnd={scrollableFile ? undefined : onSwipeEnd}
    >
      <header className={`media-viewer-top${chrome ? '' : ' media-viewer-chrome-hidden'}`}>
        <button type="button" className="media-viewer-back" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">
          <BackIcon />
        </button>
        <div className="media-viewer-meta">
          <div className="media-viewer-title">{displayTitle}</div>
          {subtitle && <div className="media-viewer-subtitle">{subtitle}</div>}
          {albumPosition && <div className="media-viewer-album-pos">{albumPosition}</div>}
          {ephemeral?.mode === 'timer' && (
            <EphemeralCountdownBadge
              ephemeral={ephemeral}
              messageTimestamp={messageTimestamp}
              className="media-ephemeral-countdown--viewer"
            />
          )}
        </div>
      </header>

      <div
        className={`media-viewer-stage${scrollableFile ? ' media-viewer-stage-scroll' : ''}${scrollableFile && docZoom.scale > 1.05 ? ' media-viewer-stage-zoomed' : ''}`}
        style={
          scrollableFile
            ? undefined
            : {
                transform: `translate(${slideX}px, ${dismissY * 0.45}px) scale(${contentScale})`,
                transition: slideSmooth
                  ? 'transform 0.32s cubic-bezier(0.25, 0.1, 0.25, 1)'
                  : 'none',
              }
        }
        onTouchStart={scrollableFile && docZoom.scale <= 1.05 ? stopTouchBubble : undefined}
        onTouchMove={scrollableFile && docZoom.scale <= 1.05 ? stopTouchBubble : undefined}
        onClick={(e) => {
          if (scrollableFile) return;
          e.stopPropagation();
          if (kind === 'image') toggleChrome();
        }}
      >
        {kind === 'image' && (
          <div
            className="media-viewer-zoom-wrap"
            style={zoom.style}
            onTouchStart={zoom.onTouchStart}
            onTouchMove={zoom.onTouchMove}
            onTouchEnd={zoom.onTouchEnd}
            onWheel={zoom.onWheel}
          >
            <img src={mediaSrc} alt={fileName ?? 'Photo'} className="media-viewer-image" draggable={false} />
          </div>
        )}
        {kind === 'video' && <MediaViewerVideo src={mediaSrc} chrome={chrome} onToggleChrome={toggleChrome} />}
        {kind === 'file' && fileSrc && fileData && (
          <div
            className={`file-viewer-zoom-wrap${scrollableFile ? ' file-viewer-zoom-wrap-docs' : ''}`}
            style={scrollableFile ? docZoom.style : undefined}
            onTouchStart={scrollableFile ? docZoom.onTouchStart : undefined}
            onTouchMove={scrollableFile ? docZoom.onTouchMove : undefined}
            onTouchEnd={scrollableFile ? docZoom.onTouchEnd : undefined}
            onWheel={scrollableFile ? docZoom.onWheel : undefined}
          >
            <div
              className={`file-viewer-stage file-viewer-stage-${fileMode ?? 'preview'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <FileViewerStage
                blobUrl={fileSrc}
                data={fileData}
                fileName={fileName ?? 'file'}
                mime={mime}
                mode={fileMode ?? 'preview'}
                videoChrome={chrome}
                onToggleVideoChrome={toggleChrome}
              />
            </div>
          </div>
        )}
        {kind === 'file' && !fileSrc && (
          <div className="file-viewer-status">Loading file…</div>
        )}
      </div>

      <footer className="media-viewer-bottom">
        <div className="media-viewer-actions">
          <button
            type="button"
            className="media-viewer-action"
            disabled={busy || !messageId || actionsLocked}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (actionsLocked || !messageId) return;
              setShareOpen(true);
            }}
          >
            <span className="media-viewer-action-icon" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                <path d="M16 6l-4-4-4 4" />
                <path d="M12 2v13" />
              </svg>
            </span>
            <span className="media-viewer-action-label">Share</span>
          </button>
          {kind !== 'file' ? (
            <button
              type="button"
              className="media-viewer-action"
              disabled={busy || !messageId || actionsLocked}
              onClick={(e) => {
                e.stopPropagation();
                if (actionsLocked) return;
                void runSave();
              }}
            >
              <span className="media-viewer-action-icon" aria-hidden>
                <SaveIcon />
              </span>
              <span className="media-viewer-action-label">Save</span>
            </button>
          ) : (
            <button
              type="button"
              className="media-viewer-action"
              disabled={busy || !fileSrc || actionsLocked}
              onClick={(e) => {
                e.stopPropagation();
                if (actionsLocked) return;
                void runSave();
              }}
            >
              <span className="media-viewer-action-icon" aria-hidden>
                <SaveIcon />
              </span>
              <span className="media-viewer-action-label">Save</span>
            </button>
          )}
        </div>
      </footer>

      <ShareContactSheet
        open={shareOpen}
        contacts={shareContactTargets}
        groups={shareGroupTargets}
        onClose={() => setShareOpen(false)}
        onPick={(id) => void forwardTo(id)}
        onExternalShare={() => void runExternalShare()}
      />
    </div>
  );

  return createPortal(viewer, document.body);
}
