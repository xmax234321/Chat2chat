import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackIcon } from './Icons';
import { GalleryBatchComposer, type GalleryBatchEntry } from './GalleryBatchComposer';
import { GalleryDetailHeader } from './GalleryDetailHeader';
import { MediaSendOptionsSheet } from './MediaSendOptionsSheet';
import { SfRepeatCircleIcon } from './settings/SettingsSfIcons';
import type { MediaSendOptions } from './MediaSendComposer';
import { useImageZoom } from '../hooks/useImageZoom';
import { usePinToKeyboardBottom } from '../hooks/usePinToKeyboardBottom';
import { useGalleryDragSelect } from '../hooks/useGalleryDragSelect';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { isCapacitor } from '../lib/platform';
import {
  exportGallerySelection,
  editedGalleryFileName,
  galleryItemFileName,
  galleryItemKey,
  isGalleryPermissionGranted,
  listGalleryAssets,
  loadGalleryDetailPreview,
  loadGalleryThumbnail,
  pickedFromWebFiles,
  readGalleryPermissionStatus,
  webGalleryItem,
  type GalleryPreparedItem,
  type GallerySelectionItem,
  type GalleryTab,
} from '../lib/gallery-assets';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import type { SendQuality } from '../lib/pick-media';
import { isUserCancelled, pickCameraMedia } from '../lib/pick-ios-media';
import { DevicePermissionSheet } from './DevicePermissionSheet';
import { MediaImageEditorOverlay, type MediaImageEditorHandle } from './MediaImageEditorOverlay';
import { waitAfterModalClose } from '../lib/wait-ui';

type Props = {
  open: boolean;
  connected?: boolean;
  allowEphemeral?: boolean;
  onClose: () => void;
  onSendBatch: (items: GalleryPreparedItem[]) => void;
  onSendOne: (item: GalleryPreparedItem) => void;
  onError: (message: string) => void;
};

const DEFAULT_SEND_OPTIONS: MediaSendOptions = { caption: '', ephemeral: null };

function formatDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sendModeLabel(ephemeral: EphemeralMedia | null): string {
  if (!ephemeral) return 'Normal';
  if (ephemeral.mode === 'after_view') return 'After view';
  if (ephemeral.ttlSec >= 60) return `${Math.round(ephemeral.ttlSec / 60)}m`;
  return `${ephemeral.ttlSec}s`;
}

export function MediaGalleryPicker({
  open,
  connected = true,
  allowEphemeral = true,
  onClose,
  onSendBatch,
  onSendOne,
  onError,
}: Props) {
  const [tab, setTab] = useState<GalleryTab>('photos');
  const [assets, setAssets] = useState<GallerySelectionItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [itemConfigs, setItemConfigs] = useState<Map<string, MediaSendOptions>>(new Map());
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailCaption, setDetailCaption] = useState('');
  const [detailEphemeral, setDetailEphemeral] = useState<EphemeralMedia | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [detailSending, setDetailSending] = useState(false);
  const [detailPreviewUrl, setDetailPreviewUrl] = useState('');
  const [detailPreviewLoading, setDetailPreviewLoading] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchEntries, setBatchEntries] = useState<GalleryBatchEntry[]>([]);
  const [detailSendQuality, setDetailSendQuality] = useState<SendQuality>('full');
  const [galleryAccess, setGalleryAccess] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [cameraStubOpen, setCameraStubOpen] = useState(false);
  const [photosPermissionOpen, setPhotosPermissionOpen] = useState(false);
  const [detailEditMode, setDetailEditMode] = useState<'crop' | 'draw' | null>(null);
  const detailEditedRef = useRef<{ key: string; blob: Blob } | null>(null);
  const detailEditorRef = useRef<MediaImageEditorHandle>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entered, setEntered] = useState(false);
  const assetsOffsetRef = useRef(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const thumbCache = useRef<Map<string, string>>(new Map());
  const detailPreviewCache = useRef<Map<string, string>>(new Map());
  const detailRootRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  const openedRef = useRef(false);
  const loadingTabRef = useRef<GalleryTab | null>(null);
  const detailItemOverrideRef = useRef<GallerySelectionItem | null>(null);
  const detailZoom = useImageZoom(Boolean(detailKey && detailPreviewUrl && !detailEditMode));

  const dragSelectEnabled = open && galleryAccess === 'granted' && !detailKey && !batchOpen;
  const { scrollRef, consumeTapIfDragged } = useGalleryDragSelect({
    enabled: dragSelectEnabled,
    selected,
    setSelected,
  });

  usePinToKeyboardBottom(composerRef, Boolean(detailKey && !detailEditMode));

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const closeDetailView = useCallback(() => {
    if (detailKey) {
      setItemConfigs((prev) => {
        const next = new Map(prev);
        next.set(detailKey, { caption: detailCaption.trim(), ephemeral: detailEphemeral });
        return next;
      });
    }
    detailRootRef.current?.style.removeProperty('--gallery-preview-height');
    detailItemOverrideRef.current = null;
    detailEditedRef.current = null;
    setDetailEditMode(null);
    setDetailKey(null);
    setOptionsOpen(false);
  }, [detailCaption, detailEphemeral, detailKey]);

  const dismiss = useSwipeToDismiss({
    enabled: Boolean(detailKey),
    onDismiss: closeDetailView,
    blockWhen: () => detailZoom.scale > 1.05 || Boolean(detailEditMode),
  });

  onErrorRef.current = onError;

  const loadAssets = useCallback(async (nextTab: GalleryTab, append = false) => {
    if (!isCapacitor()) return;
    loadingTabRef.current = nextTab;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const offset = append ? assetsOffsetRef.current : 0;
      const { assets: list, total: count } = await listGalleryAssets(nextTab, offset);
      if (loadingTabRef.current !== nextTab) return;
      setTotal(count);
      const items: GallerySelectionItem[] = list.map((asset) => ({
        kind: 'native',
        asset,
        thumbUrl: thumbCache.current.get(asset.id),
      }));
      assetsOffsetRef.current = offset + list.length;
      setAssets((prev) => (append ? [...prev, ...items] : items));

      for (const item of items) {
        if (item.kind !== 'native' || item.thumbUrl) continue;
        const id = item.asset.id;
        void loadGalleryThumbnail(id, 280).then((url) => {
          thumbCache.current.set(id, url);
          setAssets((prev) =>
            prev.map((row) =>
              row.kind === 'native' && row.asset.id === id ? { ...row, thumbUrl: url } : row,
            ),
          );
        }).catch(() => {
          /* skip broken thumb */
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load gallery';
      if (/access denied|photo library/i.test(message)) {
        setGalleryAccess('denied');
        setPhotosPermissionOpen(true);
        setAssets([]);
        setTotal(0);
        return;
      }
      onErrorRef.current(message);
    } finally {
      if (loadingTabRef.current === nextTab) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  const handleGalleryScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || loadingMore || galleryAccess !== 'granted') return;
    if (assets.length >= total) return;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 120) return;
    void loadAssets(tab, true);
  }, [assets.length, galleryAccess, loadAssets, loading, loadingMore, tab, total, scrollRef]);

  const syncGalleryAccess = useCallback(
    async (nextTab: GalleryTab = 'photos') => {
      if (!isCapacitor()) {
        setGalleryAccess('granted');
        return;
      }
      setGalleryAccess('checking');
      const status = await readGalleryPermissionStatus();
      if (isGalleryPermissionGranted(status)) {
        setGalleryAccess('granted');
        setPhotosPermissionOpen(false);
        void loadAssets(nextTab);
        return;
      }
      setGalleryAccess('denied');
      setPhotosPermissionOpen(true);
      setAssets([]);
      setTotal(0);
      setLoading(false);
    },
    [loadAssets],
  );

  const closePhotosPermissionSheet = () => {
    setPhotosPermissionOpen(false);
    void syncGalleryAccess(tab);
  };

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      detailEditedRef.current = null;
      setDetailEditMode(null);
      setDetailKey(null);
      setBatchOpen(false);
      setOptionsOpen(false);
      setGalleryAccess('checking');
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    setTab('photos');
    setAssets([]);
    setSelected(new Set());
    setItemConfigs(new Map());
    setDetailKey(null);
    setBatchOpen(false);
    void syncGalleryAccess('photos');
  }, [open, syncGalleryAccess]);

  useEffect(() => {
    if (!open) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncGalleryAccess(tab);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [open, syncGalleryAccess, tab]);

  const onTabChange = (next: GalleryTab) => {
    if (next === tab) return;
    assetsOffsetRef.current = 0;
    setTab(next);
    setSelected(new Set());
    setDetailKey(null);
    setBatchOpen(false);
    if (galleryAccess === 'granted') void loadAssets(next);
    else setAssets([]);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetail = (key: string, itemOverride?: GallerySelectionItem) => {
    const item = itemOverride ?? assets.find((row) => galleryItemKey(row) === key);
    const config = itemConfigs.get(key) ?? DEFAULT_SEND_OPTIONS;
    const isVideo =
      item?.kind === 'native'
        ? item.asset.mediaType === 'video'
        : item?.picked.mime.startsWith('video/');
    detailItemOverrideRef.current = itemOverride ?? null;
    detailEditedRef.current = null;
    setDetailEditMode(null);
    detailPreviewCache.current.delete(key);
    setDetailKey(key);
    setDetailCaption(config.caption);
    setDetailEphemeral(config.ephemeral);
    setDetailSendQuality(isVideo ? 'compressed' : 'full');
    setOptionsOpen(false);
    dismiss.reset();
  };

  const lockPreviewHeight = () => {
    const preview = previewRef.current;
    const root = detailRootRef.current;
    if (!preview || !root) return;
    const height = Math.round(preview.getBoundingClientRect().height);
    if (height > 0) root.style.setProperty('--gallery-preview-height', `${height}px`);
  };

  const detailItem = detailKey
    ? assets.find((item) => galleryItemKey(item) === detailKey) ?? detailItemOverrideRef.current
    : null;

  const detailIsVideo =
    detailItem?.kind === 'native'
      ? detailItem.asset.mediaType === 'video'
      : detailItem?.picked.mime.startsWith('video/');

  useEffect(() => {
    if (!detailKey || !detailItem) {
      setDetailPreviewUrl('');
      setDetailPreviewLoading(false);
      return;
    }
    if (detailEditMode) return;
    if (detailEditedRef.current?.key === detailKey) return;

    const cached = detailPreviewCache.current.get(detailKey);
    if (cached) {
      setDetailPreviewUrl(cached);
      setDetailPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setDetailPreviewLoading(true);
    setDetailPreviewUrl(detailItem.thumbUrl ?? '');
    void loadGalleryDetailPreview(detailItem)
      .then((url) => {
        if (cancelled || !url) return;
        detailPreviewCache.current.set(detailKey, url);
        setDetailPreviewUrl(url);
      })
      .catch(() => {
        /* keep grid thumb */
      })
      .finally(() => {
        if (!cancelled) setDetailPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailItem, detailKey, detailEditMode]);

  const webAccept = tab === 'photos' ? 'image/*' : 'video/*';

  const addWebFiles = async (files: File[]) => {
    if (!files.length) return;
    try {
      const picked = await pickedFromWebFiles(files);
      const nextItems: GallerySelectionItem[] = picked.map((p) => webGalleryItem(p));
      setAssets((prev) => [...prev, ...nextItems]);
      setSelected((prev) => {
        const next = new Set(prev);
        nextItems.forEach((item) => {
          next.add(galleryItemKey(item));
        });
        return next;
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not read files');
    }
  };

  const addFromCamera = async () => {
    if (!isCapacitor()) return;
    await waitAfterModalClose();
    try {
      const picked = await pickCameraMedia();
      const item = webGalleryItem(picked);
      const key = galleryItemKey(item);
      setAssets((prev) => [...prev, item]);
      setSelected((prev) => new Set(prev).add(key));
      openDetail(key, item);
    } catch (e) {
      if (isUserCancelled(e)) return;
      const message = e instanceof Error ? e.message : 'Could not open camera';
      if (/camera|permission|denied|microphone|unavailable/i.test(message)) {
        setCameraStubOpen(true);
        return;
      }
      onError(message);
    }
  };

  const openBatchComposer = () => {
    const chosen: GalleryBatchEntry[] = [];
    assets.forEach((item) => {
      const key = galleryItemKey(item);
      if (selected.has(key)) chosen.push({ key, item });
    });
    if (!chosen.length) return;
    if (chosen.length === 1) {
      openDetail(chosen[0]!.key);
      return;
    }
    setBatchEntries(chosen);
    setBatchOpen(true);
  };

  const handleDetailSend = async () => {
    if (!detailKey || !detailItem) return;
    setDetailSending(true);
    try {
      let editedBlob =
        detailEditedRef.current?.key === detailKey ? detailEditedRef.current.blob : null;
      if (detailEditMode && detailEditorRef.current) {
        const pending = await detailEditorRef.current.commit();
        if (pending) {
          editedBlob = pending;
          detailEditedRef.current = { key: detailKey, blob: pending };
          const url = URL.createObjectURL(pending);
          setDetailPreviewUrl(url);
          detailPreviewCache.current.set(detailKey, url);
          setDetailEditMode(null);
        }
      }

      if (editedBlob && !detailIsVideo) {
        const mime = editedBlob.type || 'image/jpeg';
        const fileName = editedGalleryFileName(galleryItemFileName(detailItem), mime);
        const data = new Uint8Array(await editedBlob.arrayBuffer());
        const file = new File([editedBlob], fileName, { type: mime });
        onSendOne({
          media: {
            file,
            mime,
            previewUrl: detailPreviewUrl,
            sendQuality: detailSendQuality,
            data,
            nativePath: undefined,
            nativeSize: data.length,
          },
          caption: detailCaption.trim(),
          ephemeral: detailEphemeral,
          sendQuality: detailSendQuality,
        });
        detailEditedRef.current = null;
        return;
      }
      const [media] = await exportGallerySelection([detailItem]);
      onSendOne({
        media,
        caption: detailCaption.trim(),
        ephemeral: detailEphemeral,
        sendQuality: detailSendQuality,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not prepare media');
    } finally {
      setDetailSending(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div
        className={`media-gallery-picker${entered ? ' media-gallery-picker--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Gallery"
      >
        <header className="media-gallery-picker-header">
          <button type="button" className="icon-btn media-gallery-back" onClick={onClose} aria-label="Back">
            <BackIcon />
          </button>
          <div className="media-gallery-tabs">
            {(['photos', 'videos'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`media-gallery-tab${tab === t ? ' active' : ''}`}
                onClick={() => onTabChange(t)}
              >
                {t === 'photos' ? 'Photos' : 'Videos'}
              </button>
            ))}
          </div>
          <span className="media-gallery-header-spacer" aria-hidden />
        </header>

        <div
          ref={scrollRef}
          className="media-gallery-scroll"
          onScroll={handleGalleryScroll}
        >
          {galleryAccess === 'checking' ? (
            <div className="media-gallery-status">Loading…</div>
          ) : galleryAccess === 'denied' ? (
            <div className="media-gallery-status">Waiting for photo access…</div>
          ) : (
            <>
              {loading ? <div className="media-gallery-status">Loading…</div> : null}
              {!loading && !isCapacitor() && assets.length === 0 ? (
                <div className="media-gallery-web-pick">
                  <p className="subtitle">Choose {tab === 'photos' ? 'photos' : 'videos'} from your device</p>
                  <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                    Browse files
                  </button>
                </div>
              ) : null}
              <div className="media-gallery-grid">
            {isCapacitor() ? (
              <button
                type="button"
                className="media-gallery-cell media-gallery-cell--add"
                onClick={() => void addFromCamera()}
                aria-label="Open camera"
              >
                <span>+</span>
              </button>
            ) : null}
            {assets.map((item) => {
              const key = galleryItemKey(item);
              const isSelected = selected.has(key);
              const isVideo =
                item.kind === 'native'
                  ? item.asset.mediaType === 'video'
                  : item.picked.mime.startsWith('video/');
              const thumb = item.thumbUrl;
              return (
                <div
                  key={key}
                  data-gallery-key={key}
                  className={`media-gallery-cell${isSelected ? ' media-gallery-cell--selected' : ''}`}
                >
                  <div
                    className="media-gallery-preview"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (consumeTapIfDragged()) return;
                      openDetail(key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(key);
                      }
                    }}
                    aria-label={isVideo ? 'Open video' : 'Open photo'}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" className="media-gallery-thumb" loading="lazy" decoding="async" draggable={false} />
                    ) : (
                      <span className="media-gallery-thumb-placeholder" />
                    )}
                    {isVideo ? (
                      <span className="media-gallery-duration">
                        {item.kind === 'native' && item.asset.duration
                          ? formatDuration(item.asset.duration)
                          : 'Video'}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`media-gallery-check-btn${isSelected ? ' media-gallery-check-btn--on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(key);
                    }}
                    aria-label={isSelected ? 'Deselect' : 'Select to forward'}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? '✓' : ''}
                  </button>
                </div>
              );
            })}
          </div>
          {isCapacitor() && total > assets.length ? (
            <p className="media-gallery-more-hint subtitle">Showing recent {assets.length} of {total}</p>
          ) : null}
            </>
          )}
        </div>

        {!detailKey && !batchOpen && galleryAccess === 'granted' ? (
          <footer className="media-gallery-footer">
            <button
              type="button"
              className="btn-primary media-gallery-send"
              disabled={!selected.size}
              onClick={openBatchComposer}
            >
              {`Send${selected.size ? ` (${selected.size})` : ''}`}
            </button>
          </footer>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept={webAccept}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void addWebFiles(files);
          }}
        />
      </div>

      {detailItem ? (
        <div
          ref={detailRootRef}
          className={`media-gallery-detail${detailEditMode ? ' media-gallery-detail--editing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Preview"
          style={{ background: `rgba(11, 11, 12, ${dismiss.backdropOpacity})` }}
          onTouchStart={dismiss.onTouchStart}
          onTouchMove={dismiss.onTouchMove}
          onTouchEnd={dismiss.onTouchEnd}
        >
          <GalleryDetailHeader
            title={detailIsVideo ? 'Video' : 'Photo'}
            sendQuality={detailSendQuality}
            sending={detailSending}
            onBack={closeDetailView}
            onToggleQuality={() =>
              setDetailSendQuality((prev) => (prev === 'full' ? 'compressed' : 'full'))
            }
            showQuality={Boolean(detailIsVideo)}
            showEdit={!detailIsVideo}
            onCrop={() => setDetailEditMode('crop')}
            onDraw={() => setDetailEditMode('draw')}
            onSend={() => void handleDetailSend()}
          />

          <div
            ref={previewRef}
            className={`media-gallery-detail-preview${detailEditMode ? ' media-gallery-detail-preview--editing' : ''}`}
            style={{
              transform: dismiss.offsetY
                ? `translateY(${dismiss.offsetY * 0.35}px) scale(${dismiss.contentScale})`
                : undefined,
            }}
          >
            {detailPreviewLoading && !detailPreviewUrl ? (
              <div className="media-gallery-detail-placeholder">Loading…</div>
            ) : detailPreviewUrl && !detailEditMode ? (
              detailIsVideo ? (
                <video
                  src={detailPreviewUrl}
                  className="media-gallery-detail-media"
                  controls
                  playsInline
                />
              ) : (
                <div
                  className="media-gallery-detail-zoom-wrap"
                  style={detailZoom.style}
                  onTouchStart={detailZoom.onTouchStart}
                  onTouchMove={detailZoom.onTouchMove}
                  onTouchEnd={detailZoom.onTouchEnd}
                  onWheel={detailZoom.onWheel}
                >
                  <img src={detailPreviewUrl} alt="" className="media-gallery-detail-media" draggable={false} />
                </div>
              )
            ) : (
              <div className="media-gallery-detail-placeholder">Preview</div>
            )}
            {detailEditMode && detailPreviewUrl && !detailIsVideo ? (
              <MediaImageEditorOverlay
                ref={detailEditorRef}
                imageUrl={detailPreviewUrl}
                mode={detailEditMode}
                onCancel={() => setDetailEditMode(null)}
                onApply={(blob) => {
                  if (detailKey) {
                    detailEditedRef.current = { key: detailKey, blob };
                  }
                  const url = URL.createObjectURL(blob);
                  setDetailPreviewUrl(url);
                  if (detailKey) detailPreviewCache.current.set(detailKey, url);
                  setDetailEditMode(null);
                }}
              />
            ) : null}
          </div>

          {!detailEditMode ? (
          <div ref={composerRef} className="media-gallery-detail-composer">
            <div className="media-gallery-detail-caption-wrap">
              <textarea
                className="media-gallery-detail-caption input-field"
                placeholder="Add a caption…"
                value={detailCaption}
                rows={1}
                onFocus={lockPreviewHeight}
                onChange={(e) => {
                  const next = e.target.value;
                  setDetailCaption(next);
                  if (detailKey) {
                    setItemConfigs((prev) => {
                      const map = new Map(prev);
                      map.set(detailKey, { caption: next, ephemeral: detailEphemeral });
                      return map;
                    });
                  }
                }}
              />
              {allowEphemeral ? (
                <button
                  type="button"
                  className={`media-gallery-detail-options-inline${detailEphemeral ? ' media-gallery-detail-options-inline--active' : ''}`}
                  onClick={() => setOptionsOpen(true)}
                  aria-label={`Send options: ${sendModeLabel(detailEphemeral)}`}
                  title={sendModeLabel(detailEphemeral)}
                >
                  <SfRepeatCircleIcon size={22} />
                </button>
              ) : null}
            </div>
          </div>
          ) : null}
        </div>
      ) : null}

      <GalleryBatchComposer
        open={batchOpen}
        entries={batchEntries}
        initialConfigs={itemConfigs}
        connected={connected}
        allowEphemeral={allowEphemeral}
        onClose={() => setBatchOpen(false)}
        onSend={(items) => {
          setBatchOpen(false);
          onSendBatch(items);
        }}
        onError={onError}
      />

      <MediaSendOptionsSheet
        open={optionsOpen}
        connected={connected}
        ephemeral={detailEphemeral}
        onClose={() => setOptionsOpen(false)}
        onConfirm={(ephemeral) => {
          setDetailEphemeral(ephemeral);
          if (detailKey) {
            setItemConfigs((prev) => {
              const map = new Map(prev);
              map.set(detailKey, { caption: detailCaption.trim(), ephemeral });
              return map;
            });
          }
        }}
        onBlocked={onError}
      />

      {cameraStubOpen ? (
        <DevicePermissionSheet
          open={cameraStubOpen}
          needs="camera"
          onClose={() => setCameraStubOpen(false)}
        />
      ) : null}

      {photosPermissionOpen ? (
        <DevicePermissionSheet
          open={photosPermissionOpen}
          needs="photos"
          onClose={closePhotosPermissionSheet}
        />
      ) : null}
    </>,
    document.body,
  );
}
