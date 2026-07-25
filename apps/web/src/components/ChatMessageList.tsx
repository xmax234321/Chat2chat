import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ExportBlockNotice } from './ExportBlockNotice';
import { GroupInviteMessage } from './GroupInviteMessage';
import { MediaMessage } from './MediaMessage';
import { MediaAlbumMessage, isRenderableAlbum } from './MediaAlbumMessage';
import { MessageActionSheet } from './MessageActionSheet';
import { ShareContactSheet } from './ShareContactSheet';
import { VoiceMessage } from './VoiceMessage';
import { useToast } from './Toast';
import { useLongPress } from '../hooks/useLongPress';
import {
  downloadMessage,
  forwardMessages,
  messageCanCopy,
  messageCanForward,
  messageCopyText,
  messageHasDownloadableMedia,
} from '../lib/message-actions';
import { buildReplyRef } from '../lib/message-reply';
import type { MessageReplyRef } from '../lib/message-reply';
import { isSavedMessagesId } from '../lib/saved-messages';
import { LinkifyText } from '../lib/linkify';
import { isEphemeralContent } from '../lib/ephemeral-media';
import { formatMediaViewerSubtitle, formatTime, type ChatMessage } from '../lib/types';
import { isPendingDeliveryMessage } from '../lib/message-preview';
import { resolveDeliveryStatus } from '../lib/message-delivery';
import { MessageStatusTicks } from './MessageStatusTicks';
import { displayMemberName } from '../lib/group-protocol';
import { albumMessageIds, buildThreadItems, buildViewableChatMedia } from '../lib/media-group';
import { ChatThreadMediaViewer } from './ChatThreadMediaViewer';
import { useApp } from '../store/AppContext';
import { useSwipeToReply } from '../hooks/useSwipeToReply';

const GROUP_SENDER_GAP_MS = 5 * 60 * 1000;

function shouldShowGroupSender(message: ChatMessage, prev?: ChatMessage): boolean {
  if (message.direction === 'out') return false;
  if (!prev) return true;
  if (message.timestamp - prev.timestamp > GROUP_SENDER_GAP_MS) return true;
  if (prev.direction === 'out') return true;
  const prevSender = prev.senderId ?? prev.senderAlias ?? '';
  const curSender = message.senderId ?? message.senderAlias ?? '';
  return prevSender !== curSender;
}

type Props = {
  thread: ChatMessage[];
  contactId: string;
  contactAlias: string;
  isGroup?: boolean;
  cancelUpload: (messageId: string) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onSelectionModeChange: (active: boolean) => void;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onReply?: (reply: MessageReplyRef) => void;
  highlightMessageId?: string | null;
  onHighlightDone?: () => void;
};

export type ChatMessageListHandle = {
  forwardSelection: () => void;
};

function ChatMessageRow({
  message,
  contactId,
  contactAlias,
  isGroup,
  contacts,
  cancelUpload,
  selectionMode,
  selected,
  onToggleSelect,
  onLongPress,
  onReply,
  onJumpToMessage,
  showSenderLabel,
  onEphemeralClose,
  highlighted,
  sharedViewerMessageId,
  onOpenSharedViewer,
  flashMediaGroupId,
}: {
  message: ChatMessage;
  contactId: string;
  contactAlias: string;
  isGroup?: boolean;
  contacts: ReturnType<typeof useApp>['contacts'];
  cancelUpload: (messageId: string) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
  onReply?: (reply: MessageReplyRef) => void;
  onJumpToMessage?: (messageId: string) => void;
  showSenderLabel: boolean;
  onEphemeralClose?: (messageId: string) => void;
  highlighted?: boolean;
  sharedViewerMessageId?: string | null;
  onOpenSharedViewer?: (messageId: string) => void;
  flashMediaGroupId?: string | null;
}) {
  const mediaViewerOpen = sharedViewerMessageId === message.id;
  const isInvite = message.content.kind === 'group_invite';
  const isServiceNotice = message.content.kind === 'export_block_notice';
  const isEphemeral = isEphemeralContent(message.content);
  const longPress = useLongPress(onLongPress, { disabled: selectionMode || mediaViewerOpen || isInvite || isServiceNotice });
  const swipe = useSwipeToReply({
    disabled: selectionMode || mediaViewerOpen || !onReply || isInvite || isServiceNotice,
    onReply: () => {
      if (!onReply) return;
      onReply(buildReplyRef(message, senderLabel ?? 'Unknown'));
    },
  });

  const senderLabel =
    message.direction === 'out'
      ? 'You'
      : message.senderId
        ? displayMemberName(message.senderId, contacts)
        : message.senderAlias;

  const pendingDelivery = isPendingDeliveryMessage(message);
  const deliveryStatus = resolveDeliveryStatus(message);
  const mediaGroupId =
    message.content.kind === 'image' || message.content.kind === 'video'
      ? message.content.mediaGroupId
      : undefined;
  const isFlashing = Boolean(flashMediaGroupId && mediaGroupId && flashMediaGroupId === mediaGroupId);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      longPress.onClick(e);
      if (!selectionMode) return;
      if (isEphemeral) return;
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect();
    },
    [isEphemeral, longPress, onToggleSelect, selectionMode],
  );

  return (
    <div
      id={`msg-${message.id}`}
      data-message-id={message.id}
      className={`chat-msg-wrap${isServiceNotice ? ' chat-msg-wrap--service' : ''}${selectionMode ? ' chat-msg-wrap--selecting' : ''}${selected ? ' chat-msg-wrap--selected' : ''}${selectionMode && isEphemeral ? ' chat-msg-wrap--select-blocked' : ''}${highlighted ? ' chat-msg-wrap--highlight' : ''}`}
      style={{ transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined }}
      onPointerDownCapture={(e) => {
        longPress.onPointerDown(e);
        swipe.handlers.onPointerDown(e);
      }}
      onPointerMoveCapture={(e) => {
        longPress.onPointerMove(e);
        swipe.handlers.onPointerMove(e);
      }}
      onPointerUpCapture={() => {
        longPress.onPointerUp();
        swipe.handlers.onPointerUp();
      }}
      onPointerLeave={longPress.onPointerLeave}
      onPointerCancel={() => {
        longPress.onPointerCancel();
        swipe.handlers.onPointerCancel();
      }}
      onClick={handleClick}
      onContextMenu={longPress.onContextMenu}
    >
      {selectionMode && !isEphemeral && !isServiceNotice && (
        <span className={`chat-msg-check${selected ? ' chat-msg-check--on' : ''}`} aria-hidden>
          {selected ? '✓' : ''}
        </span>
      )}
      <div
        className={`chat-msg-card chat-msg-card--${message.direction === 'out' ? 'out' : 'in'}`}
        data-message-long-press
      >
      {isServiceNotice ? (
        <ExportBlockNotice
          content={message.content as Extract<ChatMessage['content'], { kind: 'export_block_notice' }>}
        />
      ) : (
      <>
      {isGroup && showSenderLabel && senderLabel && !isInvite && (
        <div className="group-sender-label">{senderLabel}</div>
      )}
      {message.replyTo && !isInvite && (
        <button
          type="button"
          className={`message-reply-quote message-reply-quote--${message.direction === 'out' ? 'out' : 'in'}`}
          onClick={(e) => {
            e.stopPropagation();
            onJumpToMessage?.(message.replyTo!.id);
          }}
        >
          <strong>{message.replyTo.senderLabel}</strong>
          <span>{message.replyTo.preview}</span>
        </button>
      )}
      {isInvite ? (
        <GroupInviteMessage message={message as ChatMessage & { content: Extract<ChatMessage['content'], { kind: 'group_invite' }> }} direction={message.direction} />
      ) : (
      <div
        className={
          message.direction === 'out'
            ? `bubble-out${pendingDelivery ? ' bubble-out--pending' : ''}${isFlashing ? ' bubble-out--sent-flash' : ''}`
            : 'bubble-in'
        }
      >
        {message.content.kind === 'text' && <LinkifyText text={message.content.body} />}
        {message.content.kind === 'voice' && (
          <VoiceMessage
            messageId={message.id}
            durationMs={message.content.durationMs}
            direction={message.direction}
            previewUrl={message.content.previewUrl}
            uploading={message.content.uploading}
            onCancel={
              message.direction === 'out' && message.content.uploading
                ? () => cancelUpload(message.id)
                : undefined
            }
            guardTap={longPress.peekLongPress}
          />
        )}
        {(message.content.kind === 'image' ||
          message.content.kind === 'video' ||
          message.content.kind === 'file') && (
          <MediaMessage
            messageId={message.id}
            contactId={contactId}
            kind={message.content.kind}
            previewUrl={message.content.previewUrl}
            fileName={message.content.fileName}
            mime={message.content.mime}
            fileSize={message.content.size}
            uploading={message.content.uploading}
            uploadProgress={
              'uploadProgress' in message.content ? message.content.uploadProgress : undefined
            }
            onCancel={
              message.direction === 'out' && message.content.uploading
                ? () => cancelUpload(message.id)
                : undefined
            }
            title={message.direction === 'out' ? 'You' : contactAlias}
            subtitle={formatMediaViewerSubtitle(message.timestamp)}
            onViewerOpenChange={(open) => {
              if (open) onOpenSharedViewer?.(message.id);
            }}
            onOpenSharedViewer={
              message.content.kind === 'image' || message.content.kind === 'video'
                ? () => onOpenSharedViewer?.(message.id)
                : undefined
            }
            guardTap={longPress.peekLongPress}
            ephemeral={'ephemeral' in message.content ? message.content.ephemeral : undefined}
            expiredPlaceholder={
              'expiredPlaceholder' in message.content ? Boolean(message.content.expiredPlaceholder) : false
            }
            messageTimestamp={message.timestamp}
            onEphemeralClose={() => onEphemeralClose?.(message.id)}
            caption={
              'caption' in message.content &&
              !('expiredPlaceholder' in message.content && message.content.expiredPlaceholder)
                ? message.content.caption
                : undefined
            }
          />
        )}
      </div>
      )}
      {!isServiceNotice && (
      <div
        className="bubble-time"
        style={{ alignSelf: message.direction === 'out' ? 'flex-end' : 'flex-start' }}
      >
        {formatTime(message.timestamp)}
        {deliveryStatus ? <MessageStatusTicks status={deliveryStatus} /> : null}
      </div>
      )}
      </>
      )}
      </div>
    </div>
  );
}

function ChatAlbumRow({
  messages,
  contactId,
  contactAlias,
  isGroup,
  contacts,
  cancelUpload,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onLongPress,
  onReply,
  onJumpToMessage,
  showSenderLabel,
  onEphemeralClose,
  highlighted,
  sharedViewerMessageId,
  onOpenSharedViewer,
  flashMediaGroupId,
}: {
  messages: ChatMessage[];
  contactId: string;
  contactAlias: string;
  isGroup?: boolean;
  contacts: ReturnType<typeof useApp>['contacts'];
  cancelUpload: (messageId: string) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: () => void;
  onLongPress: () => void;
  onReply?: (reply: MessageReplyRef) => void;
  onJumpToMessage?: (messageId: string) => void;
  showSenderLabel: boolean;
  onEphemeralClose?: (messageId: string) => void;
  highlighted?: boolean;
  sharedViewerMessageId?: string | null;
  onOpenSharedViewer?: (messageId: string) => void;
  flashMediaGroupId?: string | null;
}) {
  const message = messages[0];
  if (!message) return null;

  const mediaViewerOpen = messages.some((entry) => entry.id === sharedViewerMessageId);
  const isEphemeral = messages.some((entry) => isEphemeralContent(entry.content));
  const selected = albumMessageIds(messages).every((id) => selectedIds.has(id));
  const longPress = useLongPress(onLongPress, { disabled: selectionMode || mediaViewerOpen });
  const swipe = useSwipeToReply({
    disabled: selectionMode || mediaViewerOpen || !onReply,
    onReply: () => {
      if (!onReply) return;
      onReply(buildReplyRef(message, senderLabel ?? 'Unknown'));
    },
  });

  const senderLabel =
    message.direction === 'out'
      ? 'You'
      : message.senderId
        ? displayMemberName(message.senderId, contacts)
        : message.senderAlias;

  const pendingDelivery = messages.some((entry) => isPendingDeliveryMessage(entry));
  const deliveryStatus = resolveDeliveryStatus(message);
  const albumGroupId =
    message.content.kind === 'image' || message.content.kind === 'video'
      ? message.content.mediaGroupId
      : undefined;
  const isFlashing = Boolean(flashMediaGroupId && albumGroupId && flashMediaGroupId === albumGroupId);
  const latestTimestamp = Math.max(...messages.map((entry) => entry.timestamp));

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      longPress.onClick(e);
      if (!selectionMode) return;
      if (isEphemeral) return;
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect();
    },
    [isEphemeral, longPress, onToggleSelect, selectionMode],
  );

  return (
    <div
      id={`msg-${message.id}`}
      data-message-id={message.id}
      className={`chat-msg-wrap${selectionMode ? ' chat-msg-wrap--selecting' : ''}${selected ? ' chat-msg-wrap--selected' : ''}${selectionMode && isEphemeral ? ' chat-msg-wrap--select-blocked' : ''}${highlighted ? ' chat-msg-wrap--highlight' : ''}`}
      style={{ transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined }}
      onPointerDownCapture={(e) => {
        longPress.onPointerDown(e);
        swipe.handlers.onPointerDown(e);
      }}
      onPointerMoveCapture={(e) => {
        longPress.onPointerMove(e);
        swipe.handlers.onPointerMove(e);
      }}
      onPointerUpCapture={() => {
        longPress.onPointerUp();
        swipe.handlers.onPointerUp();
      }}
      onPointerLeave={longPress.onPointerLeave}
      onPointerCancel={() => {
        longPress.onPointerCancel();
        swipe.handlers.onPointerCancel();
      }}
      onClick={handleClick}
      onContextMenu={longPress.onContextMenu}
    >
      {selectionMode && !isEphemeral && (
        <span className={`chat-msg-check${selected ? ' chat-msg-check--on' : ''}`} aria-hidden>
          {selected ? '✓' : ''}
        </span>
      )}
      <div
        className={`chat-msg-card chat-msg-card--${message.direction === 'out' ? 'out' : 'in'}`}
        data-message-long-press
      >
        {isGroup && showSenderLabel && senderLabel && (
          <div className="group-sender-label">{senderLabel}</div>
        )}
        {message.replyTo && (
          <button
            type="button"
            className={`message-reply-quote message-reply-quote--${message.direction === 'out' ? 'out' : 'in'}`}
            onClick={(e) => {
              e.stopPropagation();
              onJumpToMessage?.(message.replyTo!.id);
            }}
          >
            <strong>{message.replyTo.senderLabel}</strong>
            <span>{message.replyTo.preview}</span>
          </button>
        )}
        <div
          className={
            message.direction === 'out'
              ? `bubble-out bubble-out--album${pendingDelivery ? ' bubble-out--pending' : ''}${isFlashing ? ' bubble-out--sent-flash' : ''}`
              : 'bubble-in bubble-in--album'
          }
        >
          <MediaAlbumMessage
            messages={messages}
            contactId={contactId}
            contactAlias={contactAlias}
            direction={message.direction}
            onCancel={
              message.direction === 'out'
                ? (messageId) => cancelUpload(messageId)
                : undefined
            }
            guardTap={longPress.peekLongPress}
            onEphemeralClose={onEphemeralClose}
            onOpenSharedViewer={onOpenSharedViewer}
          />
          {'caption' in message.content &&
          message.content.caption &&
          !messages.some(
            (entry) =>
              (entry.content.kind === 'image' || entry.content.kind === 'video') &&
              'expiredPlaceholder' in entry.content &&
              entry.content.expiredPlaceholder,
          ) ? (
            <div className="media-caption">
              <LinkifyText text={message.content.caption} />
            </div>
          ) : null}
        </div>
        <div
          className="bubble-time"
          style={{ alignSelf: message.direction === 'out' ? 'flex-end' : 'flex-start' }}
        >
          {formatTime(latestTimestamp)}
          {deliveryStatus ? <MessageStatusTicks status={deliveryStatus} /> : null}
        </div>
      </div>
    </div>
  );
}

export const ChatMessageList = forwardRef<ChatMessageListHandle, Props>(function ChatMessageList(
  {
    thread,
    contactId,
    contactAlias,
    isGroup = false,
    cancelUpload,
    selectionMode,
    selectedIds,
    onSelectionModeChange,
    onSelectedIdsChange,
    onReply,
    highlightMessageId,
    onHighlightDone,
  },
  ref,
) {
  const { contacts, groups, sendText, sendMedia, copyToClipboard, markEphemeralClosed, deleteMessage, flashMediaGroupId } = useApp();
  const { show } = useToast();
  const savedMessagesChat = isSavedMessagesId(contactId);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardQueue, setForwardQueue] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const highlightDoneRef = useRef(onHighlightDone);

  useEffect(() => {
    highlightDoneRef.current = onHighlightDone;
  }, [onHighlightDone]);

  useEffect(() => {
    if (!highlightMessageId) return;
    const exists = thread.some((m) => m.id === highlightMessageId);
    if (!exists) {
      highlightDoneRef.current?.();
      return;
    }

    setActiveHighlightId(highlightMessageId);
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`msg-${highlightMessageId}`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }, 80);
    const clearTimer = window.setTimeout(() => {
      setActiveHighlightId(null);
      highlightDoneRef.current?.();
    }, 2200);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightMessageId, thread]);

  const shareContactTargets = useMemo(
    () =>
      contacts
        .filter((c) => c.userId !== contactId)
        .map((c) => ({ id: c.userId, name: c.alias, avatar: c.avatar })),
    [contacts, contactId],
  );
  const shareGroupTargets = useMemo(
    () =>
      groups
        .filter((g) => g.id !== contactId)
        .map((g) => ({ id: g.id, name: g.name, avatar: g.avatar, isGroup: true as const })),
    [groups, contactId],
  );

  const openActions = useCallback((message: ChatMessage) => {
    setActionMessage(message);
  }, []);

  const closeActions = useCallback(() => {
    setActionMessage(null);
  }, []);

  const toggleSelected = useCallback(
    (messageId: string) => {
      const message = thread.find((m) => m.id === messageId);
      if (message && (isEphemeralContent(message.content) || message.content.kind === 'group_invite' || message.content.kind === 'export_block_notice')) return;
      const next = new Set(selectedIds);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      onSelectedIdsChange(next);
    },
    [onSelectedIdsChange, selectedIds, thread],
  );

  const jumpToMessage = useCallback((messageId: string) => {
    setActiveHighlightId(messageId);
    window.setTimeout(() => {
      document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    window.setTimeout(() => setActiveHighlightId((current) => (current === messageId ? null : current)), 2200);
  }, []);

  const beginForward = useCallback(
    (messages: ChatMessage[]) => {
      if (messages.length === 0) return;
      setForwardQueue(messages);
      setForwardOpen(true);
    },
    [],
  );

  const handleForwardPick = useCallback(
    async (targetId: string) => {
      if (busy || forwardQueue.length === 0) return;
      setBusy(true);
      try {
        await forwardMessages(forwardQueue, targetId, { sendText, sendMedia });
        show(forwardQueue.length > 1 ? `Forwarded ${forwardQueue.length} messages` : 'Forwarded');
        onSelectionModeChange(false);
        onSelectedIdsChange(new Set());
      } catch (e) {
        show(e instanceof Error ? e.message : 'Forward failed');
      } finally {
        setBusy(false);
        setForwardOpen(false);
        setForwardQueue([]);
      }
    },
    [busy, forwardQueue, onSelectedIdsChange, onSelectionModeChange, sendMedia, sendText, show],
  );

  const handleDownload = useCallback(async () => {
    if (!actionMessage) return;
    closeActions();
    try {
      await downloadMessage(actionMessage);
      const kind = actionMessage.content.kind;
      show(kind === 'file' ? 'Choose where to save' : kind === 'voice' ? 'Saved' : 'Saved to Photos');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Download failed');
    }
  }, [actionMessage, closeActions, show]);

  const handleCopy = useCallback(async () => {
    if (!actionMessage) return;
    const text = messageCopyText(actionMessage);
    if (!text) return;
    closeActions();
    try {
      await copyToClipboard(text);
      show('Copied');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not copy');
    }
  }, [actionMessage, closeActions, copyToClipboard, show]);

  const forwardSelection = useCallback(() => {
    const messages = thread.filter((m) => selectedIds.has(m.id));
    beginForward(messages);
  }, [beginForward, selectedIds, thread]);

  const threadItems = useMemo(() => buildThreadItems(thread), [thread]);
  const viewableMedia = useMemo(() => buildViewableChatMedia(thread), [thread]);
  const [viewerMessageId, setViewerMessageId] = useState<string | null>(null);

  const viewerNav = useMemo(() => {
    if (!viewerMessageId) return null;
    const index = viewableMedia.findIndex((message) => message.id === viewerMessageId);
    if (index < 0) return null;
    return {
      hasPrev: index > 0,
      hasNext: index < viewableMedia.length - 1,
      albumPosition:
        viewableMedia.length > 1 ? `${index + 1} / ${viewableMedia.length}` : undefined,
      onSwipePrev: () => setViewerMessageId(viewableMedia[index - 1]!.id),
      onSwipeNext: () => setViewerMessageId(viewableMedia[index + 1]!.id),
    };
  }, [viewableMedia, viewerMessageId]);

  const viewerMessage = viewerMessageId
    ? viewableMedia.find((message) => message.id === viewerMessageId) ?? null
    : null;

  useImperativeHandle(ref, () => ({ forwardSelection }), [forwardSelection]);

  return (
    <>
      {threadItems.map((item, index) => {
        const prevItem = index > 0 ? threadItems[index - 1] : undefined;
        const prevMessage = prevItem
          ? prevItem.type === 'album'
            ? prevItem.messages[prevItem.messages.length - 1]
            : prevItem.message
          : undefined;

        if (item.type === 'album' && isRenderableAlbum(item.messages)) {
          const ids = albumMessageIds(item.messages);
          const highlighted = ids.some((id) => activeHighlightId === id);
          return (
            <ChatAlbumRow
              key={`album-${item.messages[0]?.id ?? index}`}
              messages={item.messages}
              contactId={contactId}
              contactAlias={contactAlias}
              isGroup={isGroup}
              contacts={contacts}
              cancelUpload={cancelUpload}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={() => {
                const allSelected = ids.every((id) => selectedIds.has(id));
                const next = new Set(selectedIds);
                if (allSelected) ids.forEach((id) => next.delete(id));
                else ids.forEach((id) => next.add(id));
                onSelectedIdsChange(next);
              }}
              onLongPress={() => openActions(item.messages[0])}
              onReply={onReply}
              onJumpToMessage={jumpToMessage}
              showSenderLabel={isGroup ? shouldShowGroupSender(item.messages[0], prevMessage) : false}
              onEphemeralClose={markEphemeralClosed}
              highlighted={highlighted}
              sharedViewerMessageId={viewerMessageId}
              onOpenSharedViewer={setViewerMessageId}
              flashMediaGroupId={flashMediaGroupId}
            />
          );
        }

        const message = item.type === 'message' ? item.message : item.messages[0];
        if (!message) return null;

        return (
          <ChatMessageRow
            key={message.id}
            message={message}
            contactId={contactId}
            contactAlias={contactAlias}
            isGroup={isGroup}
            contacts={contacts}
            cancelUpload={cancelUpload}
            selectionMode={selectionMode}
            selected={selectedIds.has(message.id)}
            onToggleSelect={() => toggleSelected(message.id)}
            onLongPress={() => openActions(message)}
            onReply={onReply}
            onJumpToMessage={jumpToMessage}
            showSenderLabel={isGroup ? shouldShowGroupSender(message, prevMessage) : false}
            onEphemeralClose={markEphemeralClosed}
            highlighted={activeHighlightId === message.id}
            sharedViewerMessageId={viewerMessageId}
            onOpenSharedViewer={setViewerMessageId}
            flashMediaGroupId={flashMediaGroupId}
          />
        );
      })}

      <MessageActionSheet
        open={actionMessage != null}
        canCopy={actionMessage ? messageCanCopy(actionMessage) : false}
        canForward={actionMessage ? messageCanForward(actionMessage) : false}
        canDownload={actionMessage ? messageHasDownloadableMedia(actionMessage) : false}
        canDelete={savedMessagesChat && actionMessage != null}
        onClose={closeActions}
        onCopy={() => void handleCopy()}
        onForward={() => {
          if (!actionMessage) return;
          closeActions();
          beginForward([actionMessage]);
        }}
        onDownload={() => void handleDownload()}
        onDelete={() => {
          if (!actionMessage) return;
          deleteMessage(actionMessage.id);
          closeActions();
          show('Message deleted');
        }}
        onSelectMore={() => {
          if (!actionMessage) return;
          closeActions();
          onSelectionModeChange(true);
          onSelectedIdsChange(new Set([actionMessage.id]));
        }}
      />

      <ShareContactSheet
        open={forwardOpen}
        contacts={shareContactTargets}
        groups={shareGroupTargets}
        onClose={() => {
          setForwardOpen(false);
          setForwardQueue([]);
        }}
        onPick={(id) => void handleForwardPick(id)}
      />

      <ChatThreadMediaViewer
        message={viewerMessage}
        contactId={contactId}
        contactAlias={contactAlias}
        contacts={contacts}
        nav={viewerNav}
        onClose={() => setViewerMessageId(null)}
        onEphemeralClose={markEphemeralClosed}
      />
    </>
  );
});

export function ChatSelectionBar({
  count,
  onCancel,
  onForward,
}: {
  count: number;
  onCancel: () => void;
  onForward: () => void;
}) {
  return (
    <div className="chat-selection-bar">
      <button type="button" className="chat-selection-btn" onClick={onCancel}>
        Cancel
      </button>
      <span className="chat-selection-count">{count} selected</span>
      <button
        type="button"
        className="chat-selection-btn chat-selection-btn--primary"
        onClick={onForward}
        disabled={count === 0}
      >
        Forward
      </button>
    </div>
  );
}
