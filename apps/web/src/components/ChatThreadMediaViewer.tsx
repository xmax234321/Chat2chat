import { useMemo } from 'react';
import { MediaViewer } from './MediaViewer';
import { useBubbleMediaSources } from '../hooks/useCachedMediaPreview';
import { isEphemeralContent } from '../lib/ephemeral-media';
import { displayMemberName } from '../lib/group-protocol';
import { formatMediaViewerSubtitle, type ChatMessage, type Contact } from '../lib/types';

export type ChatMediaViewerNav = {
  hasPrev: boolean;
  hasNext: boolean;
  albumPosition?: string;
  onSwipePrev: () => void;
  onSwipeNext: () => void;
};

type Props = {
  message: ChatMessage | null;
  contactId: string;
  contactAlias: string;
  contacts: Contact[];
  nav: ChatMediaViewerNav | null;
  onClose: () => void;
  onEphemeralClose?: (messageId: string) => void;
};

export function ChatThreadMediaViewer({
  message,
  contactId,
  contactAlias,
  contacts,
  nav,
  onClose,
  onEphemeralClose,
}: Props) {
  const content = message?.content;
  const isVisual = content?.kind === 'image' || content?.kind === 'video';
  const kind = isVisual ? content.kind : null;

  const fileName = isVisual ? content.fileName : '';
  const mime = isVisual ? content.mime : undefined;
  const previewUrl = isVisual ? content.previewUrl : undefined;
  const uploading = isVisual ? Boolean(content.uploading) : false;
  const ephemeral = isVisual ? content.ephemeral : undefined;

  const { thumbSrc, playSrc } = useBubbleMediaSources(
    message?.id ?? '',
    previewUrl,
    fileName,
    mime,
    kind ?? 'image',
    uploading,
  );

  const title = useMemo(() => {
    if (!message) return '';
    if (message.direction === 'out') return 'You';
    if (message.senderId) return displayMemberName(message.senderId, contacts);
    return message.senderAlias ?? contactAlias;
  }, [contactAlias, contacts, message]);

  if (!message || !isVisual || !kind) return null;

  const handleClose = () => {
    if (isEphemeralContent({ kind, ephemeral })) {
      onEphemeralClose?.(message.id);
    }
    onClose();
  };

  return (
    <MediaViewer
      open
      kind={kind}
      src={playSrc || thumbSrc}
      fileName={content.fileName}
      mime={content.mime}
      messageId={message.id}
      contactId={contactId}
      title={title}
      subtitle={formatMediaViewerSubtitle(message.timestamp)}
      ephemeral={ephemeral}
      messageTimestamp={message.timestamp}
      onClose={handleClose}
      hasPrev={nav?.hasPrev ?? false}
      hasNext={nav?.hasNext ?? false}
      onSwipePrev={nav?.onSwipePrev}
      onSwipeNext={nav?.onSwipeNext}
      albumPosition={nav?.albumPosition}
    />
  );
}
