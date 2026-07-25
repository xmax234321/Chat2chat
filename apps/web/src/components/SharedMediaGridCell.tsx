import { useCallback, useState } from 'react';
import { useBubbleMediaSources } from '../hooks/useCachedMediaPreview';
import { formatTime } from '../lib/types';
import type { SharedMediaItem } from '../lib/chat-shared-content';
import { MediaViewer } from './MediaViewer';

type Props = {
  message: SharedMediaItem;
  contactId: string;
  contactAlias: string;
  onViewerOpenChange?: (open: boolean) => void;
};

export function SharedMediaGridCell({ message, contactId, contactAlias, onViewerOpenChange }: Props) {
  const content = message.content;
  const kind = content.kind;
  const [open, setOpen] = useState(false);

  const setViewerOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onViewerOpenChange?.(next);
    },
    [onViewerOpenChange],
  );

  const { thumbSrc, playSrc } = useBubbleMediaSources(
    message.id,
    content.previewUrl,
    content.fileName,
    content.mime,
    kind,
  );

  return (
    <>
      <button
        type="button"
        className="contact-shared-media-cell-btn"
        onClick={() => setViewerOpen(true)}
        aria-label={kind === 'image' ? 'Open photo' : 'Play video'}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={content.fileName}
            className="contact-shared-media-thumb"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="contact-shared-media-thumb contact-shared-media-thumb--loading" aria-hidden />
        )}
        {kind === 'video' ? (
          <span className="contact-shared-media-play" aria-hidden>
            ▶
          </span>
        ) : null}
      </button>
      <MediaViewer
        open={open}
        kind={kind}
        src={playSrc || thumbSrc}
        fileName={content.fileName}
        mime={content.mime}
        messageId={message.id}
        contactId={contactId}
        title={contactAlias}
        subtitle={formatTime(message.timestamp)}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
