import { memo, useCallback, useMemo } from 'react';
import { UploadMediaChip } from './UploadMediaChip';
import { EphemeralTimerOverlay } from './EphemeralTimerOverlay';
import { useBubbleMediaSources } from '../hooks/useCachedMediaPreview';
import type { ChatMessage } from '../lib/types';
import { isEphemeralContent } from '../lib/ephemeral-media';
import { isAlbumMediaContent } from '../lib/media-group';

const ALBUM_DISPLAY_LIMIT = 4;

function AlbumCell({
  message,
  onOpen,
  onCancel,
  showOverflow,
  overflowCount,
}: {
  message: ChatMessage;
  onOpen: () => void;
  onCancel?: () => void;
  showOverflow?: boolean;
  overflowCount?: number;
}) {
  const content = message.content;
  if (content.kind !== 'image' && content.kind !== 'video') return null;
  if (content.expiredPlaceholder) {
    const label = content.kind === 'video' ? 'Video deleted' : 'Photo deleted';
    return (
      <div className="media-album-cell-wrap">
        <div className="media-album-cell media-album-cell--expired" aria-hidden>
          <span className="media-expired-placeholder media-expired-placeholder--album media-expired-placeholder--blurred">
            {label}
          </span>
        </div>
      </div>
    );
  }

  const displayKind = content.kind;
  const { thumbSrc } = useBubbleMediaSources(
    message.id,
    content.previewUrl,
    content.fileName,
    content.mime,
    displayKind,
    content.uploading,
  );
  const ephemeral = content.ephemeral;
  const isEphemeral = isEphemeralContent({ kind: displayKind, ephemeral });

  return (
    <div className={`media-album-cell-wrap${content.uploading ? ' media-album-cell-wrap--busy' : ''}`}>
      {content.uploading && onCancel && (
        <button
          type="button"
          className="upload-cancel-btn upload-cancel-btn-overlay media-album-cancel-btn"
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
        className="media-album-cell"
        onClick={onOpen}
        disabled={content.uploading}
        aria-label={displayKind === 'image' ? 'Open photo' : 'Play video'}
      >
        {thumbSrc ? (
          displayKind === 'video' ? (
            <span className="media-video-thumb-wrap">
              <img src={thumbSrc} alt="" className="media-album-thumb" loading="lazy" decoding="async" />
              <span className="media-play-badge" aria-hidden>
                ▶
              </span>
            </span>
          ) : (
            <img src={thumbSrc} alt="" className="media-album-thumb" loading="lazy" decoding="async" />
          )
        ) : (
          <span className="media-album-thumb media-album-thumb--placeholder" aria-hidden />
        )}
        {content.uploading && (
          <div className="media-album-upload">
            <UploadMediaChip
              fileName={content.fileName}
              fileSize={content.size}
              uploading
              uploadProgress={content.uploadProgress}
              ringSize={32}
            />
          </div>
        )}
        {isEphemeral && ephemeral && (
          <EphemeralTimerOverlay
            ephemeral={ephemeral}
            messageTimestamp={message.timestamp}
            showEye={false}
          />
        )}
        {showOverflow && overflowCount && overflowCount > 0 ? (
          <span className="media-album-overflow">+{overflowCount}</span>
        ) : null}
      </button>
    </div>
  );
}

export const MediaAlbumMessage = memo(function MediaAlbumMessage({
  messages,
  onCancel,
  guardTap,
  onOpenSharedViewer,
}: {
  messages: ChatMessage[];
  contactId: string;
  contactAlias: string;
  direction: 'in' | 'out';
  onCancel?: (messageId: string) => void;
  guardTap?: () => boolean;
  onEphemeralClose?: (messageId: string) => void;
  onOpenSharedViewer?: (messageId: string) => void;
}) {
  const displayMessages = useMemo(() => {
    if (messages.length <= ALBUM_DISPLAY_LIMIT) return messages;
    return messages.slice(0, ALBUM_DISPLAY_LIMIT);
  }, [messages]);

  const overflowCount = messages.length > ALBUM_DISPLAY_LIMIT ? messages.length - 3 : 0;
  const layoutCount = Math.min(messages.length, ALBUM_DISPLAY_LIMIT);
  const layoutClass =
    layoutCount <= 1
      ? 'media-album-grid--count-1'
      : layoutCount === 2
        ? 'media-album-grid--count-2'
        : layoutCount === 3
          ? 'media-album-grid--count-3'
          : 'media-album-grid--count-4';

  const openAt = useCallback(
    (index: number) => {
      if (guardTap?.()) return;
      const message = messages[index];
      if (!message) return;
      const content = message.content;
      if ((content.kind === 'image' || content.kind === 'video') && content.expiredPlaceholder) return;
      if ((content.kind === 'image' || content.kind === 'video') && content.uploading) return;
      onOpenSharedViewer?.(message.id);
    },
    [guardTap, messages, onOpenSharedViewer],
  );

  return (
    <div className={`media-album-grid ${layoutClass}`}>
      {displayMessages.map((message, index) => {
        const isLastVisible = index === displayMessages.length - 1;
        const showOverflow = isLastVisible && overflowCount > 0;
        return (
          <AlbumCell
            key={message.id}
            message={message}
            onOpen={() => openAt(showOverflow ? 3 : index)}
            onCancel={onCancel ? () => onCancel(message.id) : undefined}
            showOverflow={showOverflow}
            overflowCount={showOverflow ? overflowCount : undefined}
          />
        );
      })}
    </div>
  );
});

export function isRenderableAlbum(messages: ChatMessage[]): boolean {
  return messages.length > 1 && messages.every((message) => isAlbumMediaContent(message.content));
}
