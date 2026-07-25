import { BackIcon } from './Icons';
import { SfCropIcon, SfPencilIcon } from './settings/SettingsSfIcons';
import type { SendQuality } from '../lib/pick-media';

type Props = {
  title: string;
  sendQuality: SendQuality;
  sending?: boolean;
  showQuality?: boolean;
  showEdit?: boolean;
  onBack: () => void;
  onDelete?: () => void;
  onToggleQuality: () => void;
  onCrop?: () => void;
  onDraw?: () => void;
  onSend: () => void;
};

export function GalleryDetailHeader({
  title,
  sendQuality,
  sending = false,
  showQuality = true,
  showEdit = false,
  onBack,
  onDelete,
  onToggleQuality,
  onCrop,
  onDraw,
  onSend,
}: Props) {
  return (
    <header className="media-gallery-detail-header">
      <div className="media-gallery-detail-header-left">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        {onDelete ? (
          <button type="button" className="icon-btn media-gallery-detail-delete" onClick={onDelete} aria-label="Delete">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
          </button>
        ) : null}
      </div>
      <span className="media-gallery-detail-title">{title}</span>
      <div className="media-gallery-detail-header-right">
        {showQuality ? (
          <button
            type="button"
            className="media-gallery-quality-btn"
            onClick={onToggleQuality}
            aria-label={`Send quality: ${sendQuality === 'full' ? 'Full size' : 'Compressed'}`}
          >
            {sendQuality === 'full' ? 'Full' : 'Compress'}
          </button>
        ) : null}
        {showEdit ? (
          <>
            <button type="button" className="icon-btn" onClick={onCrop} aria-label="Crop">
              <SfCropIcon size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={onDraw} aria-label="Draw">
              <SfPencilIcon size={18} />
            </button>
          </>
        ) : null}
        <button type="button" className="media-gallery-detail-send" disabled={sending} onClick={onSend}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </header>
  );
}
