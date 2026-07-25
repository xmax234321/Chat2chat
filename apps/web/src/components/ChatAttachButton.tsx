import { useRef, useState } from 'react';
import { AttachIcon } from './Icons';
import { AttachMediaSheet } from './AttachMediaSheet';
import { MediaGalleryPicker } from './MediaGalleryPicker';
import { MediaSendComposer, type MediaSendOptions } from './MediaSendComposer';
import { DevicePermissionSheet } from './DevicePermissionSheet';
import { SendQualitySheet } from './SendQualitySheet';
import { pickAndValidateFile, pickAndValidateMediaFile, type PickedMedia, type SendQuality } from '../lib/pick-media';
import type { GalleryPreparedItem } from '../lib/gallery-assets';
import { isGalleryPermissionGranted, readGalleryPermissionStatus } from '../lib/gallery-assets';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import { generateMediaGroupId } from '../lib/media-group';
import { defaultSendQualityForBatch, shouldAskSendQuality } from '../lib/send-quality';
import {
  isUserCancelled,
  pickCameraMedia,
  pickIosDocument,
} from '../lib/pick-ios-media';
import { isCapacitor } from '../lib/platform';
import { waitAfterModalClose } from '../lib/wait-ui';
import { notifyToast, notifyMessage } from '../lib/notify';
import { ephemeralSendAllowed } from '../lib/ephemeral-send-policy';
import { useApp } from '../store/AppContext';

type Props = {
  disabled?: boolean;
  chatId: string;
  onPicked: (media: PickedMedia) => void | Promise<void>;
  onError: (message: string) => void;
  onBatchSent?: (mediaGroupId: string) => void;
};

type QueueEntry =
  | { kind: 'file'; media: PickedMedia }
  | {
      kind: 'visual-batch';
      items: PickedMedia[];
      caption: string;
      ephemeral: EphemeralMedia | null;
      sendQuality?: SendQuality;
    };

const FILE_ACCEPT =
  '.pdf,.zip,.txt,application/pdf,application/zip,application/x-zip-compressed,text/plain,application/octet-stream';
const CAMERA_ACCEPT = 'image/*,video/*,.mp4,.mov,.m4v,.webm,.heic,.heif';

function isVisualMedia(picked: PickedMedia): boolean {
  return (
    !picked.isFile &&
    !picked.isVoice &&
    (picked.mime.startsWith('image/') || picked.mime.startsWith('video/'))
  );
}

function notifyVideoPreparing() {
  notifyToast('Preparing video — please wait');
  notifyMessage('Video', 'Preparing video — please wait');
}

function splitPickedBatch(items: PickedMedia[]): QueueEntry[] {
  const visuals: PickedMedia[] = [];
  const entries: QueueEntry[] = [];
  for (const item of items) {
    if (isVisualMedia(item)) visuals.push(item);
    else entries.push({ kind: 'file', media: item });
  }
  if (visuals.length) {
    entries.unshift({ kind: 'visual-batch', items: visuals, caption: '', ephemeral: null });
  }
  return entries;
}

export function ChatAttachButton({ disabled, chatId, onPicked, onError, onBatchSent }: Props) {
  const { connected } = useApp();
  const allowEphemeral = ephemeralSendAllowed(chatId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const [galleryPermissionSheetOpen, setGalleryPermissionSheetOpen] = useState(false);
  const [composerItems, setComposerItems] = useState<PickedMedia[]>([]);
  const pendingBatchRef = useRef<PickedMedia[] | null>(null);
  const pendingCaptionRef = useRef('');
  const pendingEphemeralRef = useRef<EphemeralMedia | null>(null);
  const mediaQueueRef = useRef<QueueEntry[]>([]);
  const busyRef = useRef(false);
  const deliveringRef = useRef(false);
  const awaitingQualityRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const closeSheet = () => setSheetOpen(false);

  const deliverMedia = async (picked: PickedMedia) => {
    await onPicked(picked);
  };

  const deliverVisualBatch = async (
    items: PickedMedia[],
    ephemeral: EphemeralMedia | null,
    quality: SendQuality,
    caption: string,
  ) => {
    const hasEphemeral = Boolean(ephemeral) || items.some((item) => item.ephemeral);
    const useAlbum = items.length > 1 && !hasEphemeral;
    const groupId = useAlbum ? generateMediaGroupId() : undefined;
    const trimmedCaption = caption.trim();

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const itemEphemeral = item.ephemeral ?? ephemeral;
      const itemCaption =
        items.length === 1
          ? trimmedCaption || item.caption?.trim()
          : index === 0
            ? trimmedCaption || item.caption?.trim()
            : item.caption?.trim();
      try {
        await deliverMedia({
          ...item,
          ephemeral: itemEphemeral,
          sendQuality: item.sendQuality ?? quality,
          caption: itemCaption || undefined,
          ...(groupId
            ? { mediaGroupId: groupId, mediaGroupIndex: index, mediaGroupTotal: items.length }
            : {}),
        });
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Failed to send';
        onError(raw);
      }
      if (index < items.length - 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    }
    if (groupId) onBatchSent?.(groupId);
  };

  const processMediaQueue = async () => {
    if (deliveringRef.current || awaitingQualityRef.current) return;

    const next = mediaQueueRef.current[0];
    if (!next) return;

    if (next.kind === 'file') {
      mediaQueueRef.current.shift();
      deliveringRef.current = true;
      try {
        await deliverMedia(next.media);
      } finally {
        deliveringRef.current = false;
      }
      void processMediaQueue();
      return;
    }

    const batch = next.items;
    if (!batch.length) {
      mediaQueueRef.current.shift();
      void processMediaQueue();
      return;
    }

    pendingBatchRef.current = batch;
    pendingCaptionRef.current = next.caption;
    pendingEphemeralRef.current = next.ephemeral;

    const presetQuality =
      next.kind === 'visual-batch'
        ? next.sendQuality ?? batch.find((item) => item.sendQuality)?.sendQuality
        : undefined;
    if (presetQuality || !shouldAskSendQuality(batch)) {
      void finishQualityChoice(presetQuality ?? defaultSendQualityForBatch(batch));
      return;
    }
    awaitingQualityRef.current = true;
    setQualityOpen(true);
  };

  const enqueueEntries = (entries: QueueEntry[]) => {
    if (!entries.length) return;
    mediaQueueRef.current.push(...entries);
    void processMediaQueue();
  };

  const openComposer = (items: PickedMedia[]) => {
    if (!items.length) return;
    setComposerItems(items);
    setComposerOpen(true);
  };

  const openCameraCapture = async () => {
    await waitAfterModalClose();
    if (!isCapacitor()) {
      cameraRef.current?.click();
      return;
    }
    await runPick(() => pickCameraMedia());
  };

  const pickCamera = () => {
    closeSheet();
    void openCameraCapture();
  };

  const enqueuePreparedVisuals = (items: GalleryPreparedItem[]) => {
    if (!items.length) return;

    const sanitized = allowEphemeral ? items : items.map((item) => ({ ...item, ephemeral: null }));
    const ephemeralItems = sanitized.filter((item) => item.ephemeral);
    const normalItems = sanitized.filter((item) => !item.ephemeral);
    const entries: QueueEntry[] = [];

    if (normalItems.length) {
      entries.push({
        kind: 'visual-batch',
        items: normalItems.map((item) => ({
          ...item.media,
          caption: item.caption.trim() || item.media.caption,
          sendQuality: item.sendQuality,
        })),
        caption: '',
        ephemeral: null,
        sendQuality: normalItems.find((item) => item.sendQuality)?.sendQuality,
      });
    }

    for (const item of ephemeralItems) {
      entries.push({
        kind: 'visual-batch',
        items: [
          {
            ...item.media,
            caption: item.caption.trim() || item.media.caption,
            sendQuality: item.sendQuality,
          },
        ],
        caption: item.caption,
        ephemeral: item.ephemeral,
        sendQuality: item.sendQuality,
      });
    }

    enqueueEntries(entries);
  };

  const onComposerSend = (options: MediaSendOptions, items: PickedMedia[]) => {
    setComposerOpen(false);
    setComposerItems([]);
    const ephemeral = allowEphemeral ? options.ephemeral : null;
    if (ephemeral) {
      enqueueEntries(
        items.map((item, index) => ({
          kind: 'visual-batch' as const,
          items: [item],
          caption: index === 0 ? options.caption : '',
          ephemeral,
        })),
      );
      return;
    }
    enqueueEntries([
      {
        kind: 'visual-batch',
        items,
        caption: options.caption,
        ephemeral: null,
      },
    ]);
  };

  const finishQualityChoice = async (quality: SendQuality) => {
    awaitingQualityRef.current = false;
    setQualityOpen(false);
    const batch = pendingBatchRef.current;
    const ephemeral = pendingEphemeralRef.current;
    const caption = pendingCaptionRef.current;
    pendingBatchRef.current = null;
    pendingEphemeralRef.current = null;
    pendingCaptionRef.current = '';
    if (!batch?.length) return;

    mediaQueueRef.current.shift();
    deliveringRef.current = true;
    try {
      await deliverVisualBatch(batch, ephemeral, quality, caption);
    } finally {
      deliveringRef.current = false;
    }
    void processMediaQueue();
  };

  const cancelQualityChoice = () => {
    awaitingQualityRef.current = false;
    setQualityOpen(false);
    pendingBatchRef.current = null;
    pendingEphemeralRef.current = null;
    pendingCaptionRef.current = '';
    mediaQueueRef.current = [];
  };

  const runPick = async (pick: () => Promise<PickedMedia>) => {
    if (disabled || busyRef.current) return;
    busyRef.current = true;
    try {
      const picked = await pick();
      if (picked.mime.startsWith('video/')) notifyVideoPreparing();
      openComposer([picked]);
    } catch (e) {
      if (isUserCancelled(e)) return;
      const raw = e instanceof Error ? e.message : String(e);
      if (/camera|permission|denied|microphone|unavailable/i.test(raw)) {
        setPermissionSheetOpen(true);
        return;
      }
      onError(/load failed/i.test(raw) ? 'Could not read file' : raw);
    } finally {
      busyRef.current = false;
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    void (async () => {
      if (disabled || busyRef.current) return;
      busyRef.current = true;
      try {
        const items: PickedMedia[] = [];
        for (const file of files) {
          items.push(await pickAndValidateFile(file));
        }
        enqueueEntries(splitPickedBatch(items));
      } catch (e) {
        if (isUserCancelled(e)) return;
        const raw = e instanceof Error ? e.message : 'Could not read file';
        onError(/load failed/i.test(raw) ? 'Could not read file' : raw);
      } finally {
        busyRef.current = false;
      }
    })();
  };

  const pickGallery = () => {
    closeSheet();
    void (async () => {
      await waitAfterModalClose();
      if (isCapacitor()) {
        const status = await readGalleryPermissionStatus();
        if (!isGalleryPermissionGranted(status)) {
          setGalleryPermissionSheetOpen(true);
          return;
        }
      }
      setGalleryOpen(true);
    })();
  };

  const closeGalleryPermissionSheet = () => {
    setGalleryPermissionSheetOpen(false);
    void (async () => {
      if (!isCapacitor()) return;
      const status = await readGalleryPermissionStatus();
      if (isGalleryPermissionGranted(status)) {
        await waitAfterModalClose();
        setGalleryOpen(true);
      }
    })();
  };

  const pickFile = () => {
    closeSheet();
    if (isCapacitor()) {
      void (async () => {
        if (disabled || busyRef.current) return;
        busyRef.current = true;
        try {
          const items = await pickIosDocument();
          enqueueEntries(splitPickedBatch(items));
        } catch (e) {
          if (isUserCancelled(e)) return;
          const raw = e instanceof Error ? e.message : 'Could not read file';
          onError(/load failed/i.test(raw) ? 'Could not read file' : raw);
        } finally {
          busyRef.current = false;
        }
      })();
      return;
    }
    fileRef.current?.click();
  };

  return (
    <>
      <button
        type="button"
        className={`attach-btn${disabled ? ' attach-btn-disabled' : ''}`}
        aria-label="Attach"
        disabled={disabled}
        onClick={() => !disabled && setSheetOpen(true)}
      >
        <AttachIcon />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        className="attach-input-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={handleFileInput}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={CAMERA_ACCEPT}
        capture="environment"
        className="attach-input-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void (async () => {
            if (disabled || busyRef.current) return;
            busyRef.current = true;
            try {
              const picked = await pickAndValidateMediaFile(file);
              if (picked.mime.startsWith('video/')) notifyVideoPreparing();
              openComposer([picked]);
            } catch (err) {
              const raw = err instanceof Error ? err.message : 'Could not read file';
              onError(raw);
            } finally {
              busyRef.current = false;
            }
          })();
        }}
      />

      <AttachMediaSheet
        open={sheetOpen}
        onClose={closeSheet}
        onGallery={pickGallery}
        onCamera={pickCamera}
        onFile={pickFile}
      />

      <MediaGalleryPicker
        open={galleryOpen}
        connected={connected}
        allowEphemeral={allowEphemeral}
        onClose={() => setGalleryOpen(false)}
        onError={onError}
        onSendOne={(item) => {
          setGalleryOpen(false);
          enqueuePreparedVisuals([item]);
        }}
        onSendBatch={(items) => {
          setGalleryOpen(false);
          enqueuePreparedVisuals(items);
        }}
      />

      <MediaSendComposer
        open={composerOpen}
        items={composerItems}
        connected={connected}
        allowEphemeral={allowEphemeral}
        onClose={() => {
          setComposerOpen(false);
          setComposerItems([]);
        }}
        onBlocked={(msg) => onError(msg)}
        onSend={onComposerSend}
      />

      <SendQualitySheet
        open={qualityOpen}
        isVideo={Boolean(pendingBatchRef.current?.some((item) => item.mime.startsWith('video/')))}
        onClose={cancelQualityChoice}
        onSend={(quality) => {
          void finishQualityChoice(quality);
        }}
      />

      <DevicePermissionSheet
        open={permissionSheetOpen}
        needs="camera"
        onClose={() => setPermissionSheetOpen(false)}
      />

      <DevicePermissionSheet
        open={galleryPermissionSheetOpen}
        needs="photos"
        onClose={closeGalleryPermissionSheet}
      />
    </>
  );
}
