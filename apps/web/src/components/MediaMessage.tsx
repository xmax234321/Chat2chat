import { memo, useMemo, useState, useCallback } from 'react';
import { FileMiniBadge } from './FileMiniBadge';
import { UploadAttachment } from './UploadAttachment';
import { UploadMediaChip } from './UploadMediaChip';
import { formatFileSize } from '../lib/file-mini-badge';
import { visualMediaKind } from '../lib/media-thumbnail';
import { useBubbleMediaSources } from '../hooks/useCachedMediaPreview';
import { MediaViewer } from './MediaViewer';
import { EphemeralTimerOverlay } from './EphemeralTimerOverlay';
import type { EphemeralMedia } from '../lib/ephemeral-media';
import { isEphemeralContent } from '../lib/ephemeral-media';
import { isNativeDocumentPreview, openNativeDocumentForMessage } from '../lib/open-office-document';
import { LinkifyText } from '../lib/linkify';

function effectiveDisplayKind(
  kind: 'image' | 'video' | 'file',
  mime: string | undefined,
  fileName: string,
): 'image' | 'video' | 'file' {
  if (kind !== 'file') return kind;
  return visualMediaKind(mime ?? '', fileName) ?? 'file';
}

function FileAttachment({
  fileName,
  fileSize,
  uploading,
  uploadProgress,
  onOpen,
  onCancel,
}: {
  fileName: string;
  fileSize?: number;
  uploading?: boolean;
  uploadProgress?: number;
  onOpen: () => void;
  onCancel?: () => void;
}) {
  if (uploading) {
    return (
      <UploadAttachment
        fileName={fileName}
        fileSize={fileSize}
        uploading
        uploadProgress={uploadProgress}
        onCancel={onCancel}
      />
    );
  }

  const sizeLabel = formatFileSize(fileSize ?? 0);

  return (
    <button
      type="button"
      className="file-row-btn"
      onClick={onOpen}
      aria-label={`Open ${fileName}`}
    >
      <FileMiniBadge fileName={fileName} />
      <span className="file-row-body">
        <span className="file-row-name">{fileName}</span>
        {sizeLabel ? <span className="file-row-meta">{sizeLabel}</span> : null}
      </span>
    </button>
  );
}

export const MediaMessage = memo(function MediaMessage({
  messageId,
  contactId,
  kind,
  previewUrl,
  fileName,
  mime,
  fileSize,
  uploading = false,
  uploadProgress,
  onCancel,
  title,
  subtitle,
  onViewerOpenChange,
  guardTap,
  ephemeral,
  messageTimestamp = Date.now(),
  onEphemeralClose,
  expiredPlaceholder = false,
  onOpenSharedViewer,
  caption,
}: {
  messageId: string;
  contactId: string;
  kind: 'image' | 'video' | 'file';
  previewUrl?: string;
  fileName: string;
  mime?: string;
  fileSize?: number;
  uploading?: boolean;
  uploadProgress?: number;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  onViewerOpenChange?: (open: boolean) => void;
  guardTap?: () => boolean;
  ephemeral?: EphemeralMedia | null;
  messageTimestamp?: number;
  onEphemeralClose?: () => void;
  expiredPlaceholder?: boolean;
  onOpenSharedViewer?: () => void;
  caption?: string;
}) {
  const isEphemeral = isEphemeralContent({ kind, ephemeral: ephemeral ?? undefined });
  const displayKind = useMemo(
    () => effectiveDisplayKind(kind, mime, fileName),
    [kind, mime, fileName],
  );
  const { thumbSrc, playSrc } = useBubbleMediaSources(
    messageId,
    previewUrl,
    fileName,
    mime,
    displayKind,
    uploading,
  );
  const [open, setOpen] = useState(false);

  const setViewerOpen = useCallback(
    (next: boolean) => {
      const wasOpen = open;
      setOpen(next);
      onViewerOpenChange?.(next);
      if (wasOpen && !next && isEphemeral) onEphemeralClose?.();
    },
    [isEphemeral, onEphemeralClose, onViewerOpenChange, open],
  );

  const usesSharedViewer =
    Boolean(onOpenSharedViewer) && (displayKind === 'image' || displayKind === 'video');

  const openViewer = useCallback(() => {
    if (expiredPlaceholder) return;
    if (guardTap?.()) return;
    if (uploading) return;
    if (usesSharedViewer) {
      onOpenSharedViewer?.();
      onViewerOpenChange?.(true);
      return;
    }
    if (displayKind === 'file' && isNativeDocumentPreview(fileName)) {
      void (async () => {
        try {
          const opened = await openNativeDocumentForMessage(messageId, fileName);
          if (!opened) setViewerOpen(true);
        } catch {
          setViewerOpen(true);
        }
      })();
      return;
    }
    setViewerOpen(true);
  }, [displayKind, expiredPlaceholder, fileName, guardTap, messageId, onOpenSharedViewer, onViewerOpenChange, setViewerOpen, uploading, usesSharedViewer]);

  if (expiredPlaceholder) {
    return (
      <span className="media-expired-placeholder media-expired-placeholder--blurred" aria-label={kind === 'video' ? 'Video was viewed' : 'Photo was viewed'}>
        <span className="media-expired-placeholder-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="m3 3 18 18" />
          </svg>
        </span>
        {kind === 'video' ? 'Video deleted after viewing' : 'Photo deleted after viewing'}
      </span>
    );
  }

  if (displayKind === 'file') {
    return (
      <>
        <FileAttachment
          fileName={fileName}
          fileSize={fileSize}
          uploading={uploading}
          uploadProgress={uploadProgress}
          onCancel={onCancel}
          onOpen={openViewer}
        />
        <MediaViewer
          open={open}
          kind="file"
          src=""
          fileName={fileName}
          mime={mime}
          messageId={messageId}
          contactId={contactId}
          title={title}
          subtitle={subtitle}
          ephemeral={ephemeral}
          messageTimestamp={messageTimestamp}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  if (!thumbSrc && !uploading) {
    return (
      <span className="media-placeholder">
        <span className="media-placeholder-icon" aria-hidden>
          {displayKind === 'image' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
              <path d="m21 16-5.5-5.5L5 20" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="m16 10 5-3v10l-5-3z" fill="currentColor" stroke="none" />
            </svg>
          )}
        </span>
        {fileName}
      </span>
    );
  }

  return (
    <>
      <div className={`upload-media-wrap${uploading ? ' upload-media-wrap-busy' : ''}`}>
        {uploading && onCancel && (
          <button
            type="button"
            className="upload-cancel-btn upload-cancel-btn-overlay"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            aria-label="Cancel upload"
          >
            ×
          </button>
        )}
        <button
          type="button"
          className={`media-bubble-btn${isEphemeral ? ' media-bubble-btn--ephemeral' : ''}`}
          onClick={openViewer}
          aria-label={displayKind === 'image' ? 'Open photo' : 'Play video'}
          disabled={uploading}
        >
          {thumbSrc && displayKind === 'image' ? (
            <img src={thumbSrc} alt={fileName} className="media-thumb" loading="lazy" decoding="async" />
          ) : thumbSrc ? (
            <span className="media-video-thumb-wrap">
              <img src={thumbSrc} alt={fileName} className="media-thumb media-thumb-video" loading="lazy" decoding="async" />
              <span className="media-play-badge" aria-hidden>
                ▶
              </span>
            </span>
          ) : (
            <span className="media-thumb media-thumb-placeholder" aria-hidden />
          )}
          {isEphemeral && (
            <EphemeralTimerOverlay ephemeral={ephemeral} messageTimestamp={messageTimestamp} />
          )}
        </button>
        {uploading && (
          <div className="upload-media-overlay">
            {displayKind === 'video' && (uploadProgress ?? 0) < 20 && (
              <div className="upload-video-status">Preparing video…</div>
            )}
            <UploadMediaChip
              fileName={fileName}
              fileSize={fileSize}
              uploading
              uploadProgress={uploadProgress}
              ringSize={40}
            />
          </div>
        )}
      </div>
      {caption ? <div className="media-caption"><LinkifyText text={caption} /></div> : null}
      {!usesSharedViewer && (
        <MediaViewer
          open={open}
          kind={displayKind}
          src={playSrc || thumbSrc}
          fileName={fileName}
          mime={mime}
          messageId={messageId}
          contactId={contactId}
          title={title}
          subtitle={subtitle}
          ephemeral={ephemeral}
          messageTimestamp={messageTimestamp}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
});
