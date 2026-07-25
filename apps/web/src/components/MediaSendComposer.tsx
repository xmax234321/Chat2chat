import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackIcon } from './Icons';
import { EphemeralTimerPickerSheet } from './EphemeralTimerPickerSheet';
import { MediaImageEditorOverlay, type MediaImageEditorHandle } from './MediaImageEditorOverlay';
import { SfCropIcon, SfPencilIcon } from './settings/SettingsSfIcons';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import { EPHEMERAL_TIMER_OPTIONS } from '../lib/ephemeral-media';
import { applyEditToPickedMedia } from '../lib/media-image-edit';
import { editedGalleryFileName } from '../lib/gallery-assets';
import type { PickedMedia } from '../lib/pick-media';

export type MediaSendOptions = {
  caption: string;
  ephemeral: EphemeralMedia | null;
};

type EphemeralMode = 'normal' | 'after_view' | 'timer';
type EditMode = 'crop' | 'draw';

type Props = {
  open: boolean;
  items: PickedMedia[];
  connected?: boolean;
  allowEphemeral?: boolean;
  onClose: () => void;
  onSend: (options: MediaSendOptions, items: PickedMedia[]) => void;
  onBlocked?: (message: string) => void;
};

export function MediaSendComposer({
  open,
  items: initialItems,
  connected = true,
  allowEphemeral = true,
  onClose,
  onSend,
  onBlocked,
}: Props) {
  const [items, setItems] = useState<PickedMedia[]>(initialItems);
  const [index, setIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [mode, setMode] = useState<EphemeralMode>('normal');
  const [timerSec, setTimerSec] = useState(60);
  const [timerSheetOpen, setTimerSheetOpen] = useState(false);
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const editorRef = useRef<MediaImageEditorHandle>(null);

  useEffect(() => {
    if (!open) return;
    setItems(initialItems);
    setIndex(0);
    setCaption('');
    setMode('normal');
    setTimerSec(60);
    setEditMode(null);
  }, [initialItems, open]);

  const preview = items[index] ?? items[0];
  const isVideo = preview?.mime.startsWith('video/');
  const isImage = Boolean(preview && !isVideo && preview.mime.startsWith('image/'));

  const previewUrl = useMemo(() => preview?.previewUrl ?? '', [preview]);

  if (!open || !items.length) return null;

  const buildEphemeral = (): EphemeralMedia | null => {
    if (mode === 'after_view') return { mode: 'after_view', ttlSec: 86400 };
    if (mode === 'timer') return { mode: 'timer', ttlSec: Math.max(5, timerSec) };
    return null;
  };

  const applyEditedBlob = async (blob: Blob) => {
    if (!preview) return null;
    const mime = blob.type || preview.mime || 'image/jpeg';
    const next = await applyEditToPickedMedia(
      preview,
      blob,
      editedGalleryFileName(preview.file.name, mime),
    );
    setItems((prev) => prev.map((item, i) => (i === index ? next : item)));
    setEditMode(null);
    return next;
  };

  const trySend = async () => {
    let sendItems = items;
    if (editMode && editorRef.current && preview) {
      const blob = await editorRef.current.commit();
      if (blob) {
        const next = await applyEditedBlob(blob);
        if (next) {
          sendItems = items.map((item, i) => (i === index ? next : item));
        }
      }
    }

    const ephemeral = buildEphemeral();
    if (ephemeral?.mode === 'timer' && !connected) {
      onBlocked?.('Timer media requires an internet connection');
      return;
    }
    onSend({ caption: caption.trim(), ephemeral }, sendItems);
    setCaption('');
    setMode('normal');
    setTimerSec(60);
    setIndex(0);
    setEditMode(null);
  };

  return createPortal(
    <>
      <div className={`media-send-composer${editMode ? ' media-send-composer--editing' : ''}`} role="dialog" aria-modal="true" aria-label="Send media">
        <header className="media-send-composer-header">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Back">
            <BackIcon />
          </button>
          <span className="media-send-composer-title">
            {items.length > 1 ? `${index + 1} / ${items.length}` : isVideo ? 'Video' : 'Photo'}
          </span>
          <div className="media-send-composer-header-actions">
            {isImage ? (
              <>
                <button type="button" className="icon-btn" onClick={() => setEditMode('crop')} aria-label="Crop">
                  <SfCropIcon size={18} />
                </button>
                <button type="button" className="icon-btn" onClick={() => setEditMode('draw')} aria-label="Draw">
                  <SfPencilIcon size={18} />
                </button>
              </>
            ) : null}
            <button type="button" className="media-send-composer-send" onClick={() => void trySend()}>
              Send
            </button>
          </div>
        </header>

        <div className={`media-send-composer-preview${editMode ? ' media-send-composer-preview--editing' : ''}`}>
          {previewUrl && !editMode ? (
            isVideo ? (
              <video src={previewUrl} className="media-send-composer-media" controls playsInline />
            ) : (
              <img src={previewUrl} alt="" className="media-send-composer-media" />
            )
          ) : (
            <div className="media-send-composer-placeholder">Preview</div>
          )}
          {editMode && isImage && previewUrl ? (
            <MediaImageEditorOverlay
              ref={editorRef}
              imageUrl={previewUrl}
              mode={editMode}
              onCancel={() => setEditMode(null)}
              onApply={(blob) => void applyEditedBlob(blob)}
            />
          ) : null}
          {items.length > 1 ? (
            <div className="media-send-composer-strip">
              {items.map((item, i) => (
                <button
                  key={`${item.file.name}-${i}`}
                  type="button"
                  className={`media-send-composer-thumb${i === index ? ' active' : ''}`}
                  onClick={() => setIndex(i)}
                >
                  {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <span />}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="media-send-composer-panel">
          {!editMode ? (
            <>
          <textarea
            className="media-send-composer-caption input-field"
            placeholder="Add a caption…"
            value={caption}
            rows={2}
            onChange={(e) => setCaption(e.target.value)}
          />

          {allowEphemeral ? (
            <div className="media-send-composer-ephemeral">
              <span className="media-send-composer-ephemeral-label">Delete</span>
              <div className="media-send-composer-mode-row">
                {(
                  [
                    ['normal', 'Off'],
                    ['after_view', 'After view'],
                    ['timer', 'Timer'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`media-send-mode-pill${mode === value ? ' active' : ''}`}
                    onClick={() => {
                      if (value === 'timer') {
                        if (!connected) {
                          onBlocked?.('Timer media requires an internet connection');
                          return;
                        }
                        setMode('timer');
                        return;
                      }
                      setMode(value);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === 'after_view' ? (
                <p className="media-send-composer-hint subtitle">Blurred in chat until opened, then deleted when closed</p>
              ) : null}
              {mode === 'timer' ? (
                <>
                  <div className="media-send-timer-presets">
                    {EPHEMERAL_TIMER_OPTIONS.map((opt) => (
                      <button
                        key={opt.ttlSec}
                        type="button"
                        className={`media-send-timer-pill${timerSec === opt.ttlSec ? ' active' : ''}`}
                        onClick={() => setTimerSec(opt.ttlSec)}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button type="button" className="media-send-timer-pill" onClick={() => setTimerSheetOpen(true)}>
                      Custom…
                    </button>
                  </div>
                  <p className="media-send-composer-hint subtitle">
                    Disappears {timerSec >= 60 ? `in ${Math.round(timerSec / 60)} min` : `in ${timerSec}s`}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}
            </>
          ) : null}
        </div>
      </div>

      <EphemeralTimerPickerSheet
        open={timerSheetOpen}
        connected={connected}
        onClose={() => setTimerSheetOpen(false)}
        onBlocked={onBlocked}
        onConfirm={(ephemeral) => {
          setMode('timer');
          setTimerSec(ephemeral.ttlSec);
          setTimerSheetOpen(false);
        }}
      />
    </>,
    document.body,
  );
}
