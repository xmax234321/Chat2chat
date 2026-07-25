import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GalleryDetailHeader } from './GalleryDetailHeader';
import { MediaSendOptionsSheet } from './MediaSendOptionsSheet';
import { SfRepeatCircleIcon } from './settings/SettingsSfIcons';
import type { MediaSendOptions } from './MediaSendComposer';
import { useImageZoom } from '../hooks/useImageZoom';
import { usePinToKeyboardBottom } from '../hooks/usePinToKeyboardBottom';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import {
  exportGallerySelection,
  loadGalleryDetailPreview,
  type GalleryPreparedItem,
  type GallerySelectionItem,
} from '../lib/gallery-assets';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import type { SendQuality } from '../lib/pick-media';

export type GalleryBatchEntry = {
  key: string;
  item: GallerySelectionItem;
};

const DEFAULT_OPTIONS: MediaSendOptions = { caption: '', ephemeral: null };

function sendModeLabel(ephemeral: EphemeralMedia | null): string {
  if (!ephemeral) return 'Normal';
  if (ephemeral.mode === 'after_view') return 'After view';
  if (ephemeral.ttlSec >= 60) return `${Math.round(ephemeral.ttlSec / 60)}m`;
  return `${ephemeral.ttlSec}s`;
}

function isVideoItem(item: GallerySelectionItem): boolean {
  return item.kind === 'native'
    ? item.asset.mediaType === 'video'
    : item.picked.mime.startsWith('video/');
}

type Props = {
  open: boolean;
  entries: GalleryBatchEntry[];
  initialConfigs: Map<string, MediaSendOptions>;
  connected?: boolean;
  allowEphemeral?: boolean;
  onClose: () => void;
  onSend: (items: GalleryPreparedItem[]) => void;
  onError: (message: string) => void;
};

export function GalleryBatchComposer({
  open,
  entries: initialEntries,
  initialConfigs,
  connected = true,
  allowEphemeral = true,
  onClose,
  onSend,
  onError,
}: Props) {
  const [entries, setEntries] = useState<GalleryBatchEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [configs, setConfigs] = useState<Map<string, MediaSendOptions>>(new Map());
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendQuality, setSendQuality] = useState<SendQuality>('full');
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const previewCache = useRef<Map<string, string>>(new Map());
  const composerRef = useRef<HTMLDivElement>(null);
  const detailRootRef = useRef<HTMLDivElement>(null);
  const navSwipeRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  const active = entries[index] ?? entries[0];
  const activeKey = active?.key ?? '';
  const activeConfig = configs.get(activeKey) ?? DEFAULT_OPTIONS;
  const activeIsVideo = active ? isVideoItem(active.item) : false;
  const activePreviewUrl = active ? previewUrls.get(active.key) ?? active.item.thumbUrl ?? '' : '';
  const zoom = useImageZoom(Boolean(open && activePreviewUrl && !activeIsVideo));

  const dismiss = useSwipeToDismiss({
    enabled: open,
    onDismiss: onClose,
    blockWhen: () => zoom.scale > 1.05 || dragging,
  });

  usePinToKeyboardBottom(composerRef, open);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setEntries(initialEntries);
    setIndex(0);
    setConfigs(new Map(initialConfigs));
    setPreviewUrls(new Map());
    setOptionsOpen(false);
    setSending(false);
    setDragOffset(0);
    setDragging(false);
    const first = initialEntries[0];
    setSendQuality(first && isVideoItem(first.item) ? 'compressed' : 'full');
  }, [open, initialEntries, initialConfigs]);

  useEffect(() => {
    if (!open) return;
    const activeEntry = entries[index];
    if (!activeEntry) return;
    setSendQuality(isVideoItem(activeEntry.item) ? 'compressed' : 'full');

    const cached = previewCache.current.get(activeEntry.key);
    if (cached) {
      setPreviewUrls((prev) => new Map(prev).set(activeEntry.key, cached));
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    if (activeEntry.item.thumbUrl) {
      setPreviewUrls((prev) => new Map(prev).set(activeEntry.key, activeEntry.item.thumbUrl!));
    }
    void loadGalleryDetailPreview(activeEntry.item)
      .then((url) => {
        if (cancelled || !url) return;
        previewCache.current.set(activeEntry.key, url);
        setPreviewUrls((prev) => new Map(prev).set(activeEntry.key, url));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entries, index, open]);

  const saveConfig = useCallback((key: string, patch: Partial<MediaSendOptions>) => {
    setConfigs((prev) => {
      const next = new Map(prev);
      const current = next.get(key) ?? DEFAULT_OPTIONS;
      next.set(key, { ...current, ...patch });
      return next;
    });
  }, []);

  const lockPreviewHeight = () => {
    const root = detailRootRef.current;
    const carousel = root?.querySelector('.media-gallery-batch-carousel');
    if (!root || !carousel) return;
    const height = Math.round(carousel.getBoundingClientRect().height);
    if (height > 0) root.style.setProperty('--gallery-preview-height', `${height}px`);
  };

  const deleteActive = () => {
    if (!active || entries.length <= 1) {
      onClose();
      return;
    }
    const nextEntries = entries.filter((entry) => entry.key !== active.key);
    setEntries(nextEntries);
    setIndex((prev) => Math.min(prev, nextEntries.length - 1));
  };

  const onCarouselTouchStart = (e: React.TouchEvent) => {
    dismiss.onTouchStart(e);
    if (entries.length <= 1 || e.touches.length !== 1 || zoom.scale > 1.05) return;
    navSwipeRef.current = {
      x: e.touches[0]!.clientX,
      y: e.touches[0]!.clientY,
      active: true,
    };
    setDragging(true);
    setDragOffset(0);
  };

  const onCarouselTouchMove = (e: React.TouchEvent) => {
    dismiss.onTouchMove(e);
    const start = navSwipeRef.current;
    if (!start?.active || entries.length <= 1) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 12) return;
    if ((index === 0 && dx > 0) || (index === entries.length - 1 && dx < 0)) {
      setDragOffset(dx * 0.35);
      return;
    }
    setDragOffset(dx);
  };

  const onCarouselTouchEnd = (e: React.TouchEvent) => {
    dismiss.onTouchEnd();
    const start = navSwipeRef.current;
    navSwipeRef.current = null;
    setDragging(false);
    if (!start?.active || entries.length <= 1) {
      setDragOffset(0);
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) {
      setDragOffset(0);
      return;
    }
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) {
      setDragOffset(0);
      return;
    }
    if (dx < 0 && index < entries.length - 1) setIndex(index + 1);
    if (dx > 0 && index > 0) setIndex(index - 1);
    setDragOffset(0);
  };

  const handleSendAll = async () => {
    if (!entries.length || sending) return;
    setSending(true);
    try {
      const media = await exportGallerySelection(entries.map((entry) => entry.item));
      onSend(
        media.map((picked, i) => {
          const config = configs.get(entries[i]!.key) ?? DEFAULT_OPTIONS;
          const entry = entries[i]!;
          return {
            media: picked,
            caption: config.caption,
            ephemeral: config.ephemeral,
            sendQuality: isVideoItem(entry.item) ? sendQuality : 'full',
          };
        }),
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not prepare media');
    } finally {
      setSending(false);
    }
  };

  if (!open || !entries.length) return null;

  const hasVideo = entries.some((entry) => isVideoItem(entry.item));

  return createPortal(
    <>
      <div
        ref={detailRootRef}
        className="media-gallery-detail media-gallery-batch"
        role="dialog"
        aria-modal="true"
        aria-label="Send selected media"
        style={{ background: `rgba(11, 11, 12, ${dismiss.backdropOpacity})` }}
      >
        <GalleryDetailHeader
          title={entries.length > 1 ? `${index + 1} / ${entries.length}` : activeIsVideo ? 'Video' : 'Photo'}
          sendQuality={sendQuality}
          sending={sending}
          onBack={onClose}
          onDelete={deleteActive}
          onToggleQuality={() => setSendQuality((prev) => (prev === 'full' ? 'compressed' : 'full'))}
          showQuality={hasVideo}
          onSend={() => void handleSendAll()}
        />

        <div
          className="media-gallery-batch-carousel"
          onTouchStart={onCarouselTouchStart}
          onTouchMove={onCarouselTouchMove}
          onTouchEnd={onCarouselTouchEnd}
          style={{
            transform: dismiss.offsetY ? `translateY(${dismiss.offsetY * 0.35}px) scale(${dismiss.contentScale})` : undefined,
          }}
        >
          <div
            className={`media-gallery-batch-track${dragging ? ' media-gallery-batch-track--dragging' : ''}`}
            style={{
              transform: `translateX(calc(${-index * 100}% + ${dragOffset}px))`,
            }}
          >
            {entries.map((entry) => {
              const slideUrl = previewUrls.get(entry.key) ?? entry.item.thumbUrl ?? '';
              const slideIsVideo = isVideoItem(entry.item);
              return (
                <div key={entry.key} className="media-gallery-batch-slide">
                  {previewLoading && entry.key === activeKey && !slideUrl ? (
                    <div className="media-gallery-detail-placeholder">Loading…</div>
                  ) : slideUrl ? (
                    slideIsVideo ? (
                      <video src={slideUrl} className="media-gallery-detail-media" controls playsInline />
                    ) : (
                      <img src={slideUrl} alt="" className="media-gallery-detail-media" draggable={false} />
                    )
                  ) : (
                    <div className="media-gallery-detail-placeholder">Preview</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {entries.length > 1 ? (
          <div className="media-gallery-batch-strip-wrap">
            <div className="media-gallery-batch-strip">
              {entries.map((entry, i) => {
                const thumb = entry.item.thumbUrl;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    className={`media-gallery-batch-thumb${i === index ? ' active' : ''}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Item ${i + 1}`}
                  >
                    {thumb ? <img src={thumb} alt="" /> : <span />}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div ref={composerRef} className="media-gallery-detail-composer media-gallery-batch-composer">
          <div className="media-gallery-detail-caption-wrap">
            <textarea
              className="media-gallery-detail-caption input-field"
              placeholder="Add a caption…"
              value={activeConfig.caption}
              rows={1}
              onFocus={lockPreviewHeight}
              onChange={(e) => saveConfig(activeKey, { caption: e.target.value })}
            />
            {allowEphemeral ? (
              <button
                type="button"
                className={`media-gallery-detail-options-inline${activeConfig.ephemeral ? ' media-gallery-detail-options-inline--active' : ''}`}
                onClick={() => setOptionsOpen(true)}
                aria-label={`Send options: ${sendModeLabel(activeConfig.ephemeral)}`}
                title={sendModeLabel(activeConfig.ephemeral)}
              >
                <SfRepeatCircleIcon size={22} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <MediaSendOptionsSheet
        open={optionsOpen}
        connected={connected}
        ephemeral={activeConfig.ephemeral}
        onClose={() => setOptionsOpen(false)}
        onConfirm={(ephemeral) => saveConfig(activeKey, { ephemeral })}
        onBlocked={onError}
      />
    </>,
    document.body,
  );
}
