import { createPortal } from 'react-dom';
import type { MouseEvent } from 'react';
import type { Contact } from '../lib/types';
import type { MessageListPreview } from '../lib/message-preview';
import { formatTime, contactDisplayName } from '../lib/types';
import { useLongPress } from '../hooks/useLongPress';
import { TrashIcon } from './Icons';
import { ContactAvatar } from './ContactAvatar';
import { isSavedMessagesContact } from '../lib/saved-messages';
import { MessageListPreviewLine } from './MessageListPreview';

type Props = {
  contact: Contact;
  preview: MessageListPreview;
  timestamp: number;
  unread?: number;
  active?: boolean;
  variant?: 'mobile' | 'desktop';
  onOpen: () => void;
  onPrimeOpen?: () => void;
  onDeleteRequest?: (contact: Contact) => void;
};

export function ChatListRow({
  contact,
  preview,
  timestamp,
  unread = 0,
  active = false,
  variant = 'mobile',
  onOpen,
  onPrimeOpen,
  onDeleteRequest,
}: Props) {
  const saved = isSavedMessagesContact(contact);
  const longPress = useLongPress(() => {
    if (!saved) onDeleteRequest?.(contact);
  }, {});

  const handleClick = (e: MouseEvent) => {
    longPress.onClick(e);
    if (e.defaultPrevented) return;
    onOpen();
  };

  if (variant === 'desktop') {
    return (
      <button
        type="button"
        className={`desktop-chat-item${active ? ' active' : ''}`}
        onClick={handleClick}
        onPointerDown={saved ? undefined : longPress.onPointerDown}
        onPointerMove={saved ? undefined : longPress.onPointerMove}
        onPointerUp={saved ? undefined : longPress.onPointerUp}
        onPointerLeave={saved ? undefined : longPress.onPointerLeave}
        onPointerCancel={saved ? undefined : longPress.onPointerCancel}
        onContextMenu={
          saved
            ? undefined
            : (e) => {
                e.preventDefault();
                onDeleteRequest?.(contact);
              }
        }
      >
        <ContactAvatar contact={contact} size={46} iconSize={20} />
        <div className="desktop-chat-item-body">
          <div className="desktop-chat-item-top">
            <span className="name">{contactDisplayName(contact)}</span>
            <span className="time">{timestamp ? formatTime(timestamp) : ''}</span>
          </div>
          <span className="preview">
            <MessageListPreviewLine preview={preview} />
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="chat-row"
      onClick={handleClick}
      onPointerDown={(e) => {
        onPrimeOpen?.();
        if (!saved) longPress.onPointerDown(e);
      }}
      onPointerMove={saved ? undefined : longPress.onPointerMove}
      onPointerUp={saved ? undefined : longPress.onPointerUp}
      onPointerLeave={saved ? undefined : longPress.onPointerLeave}
      onPointerCancel={saved ? undefined : longPress.onPointerCancel}
      onContextMenu={saved ? undefined : longPress.onContextMenu}
    >
      <ContactAvatar contact={contact} size={46} iconSize={20} />
      <div style={{ flex: 1, minWidth: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#F4F4F3' }}>{contactDisplayName(contact)}</span>
          <span style={{ font: "400 11px 'JetBrains Mono', monospace", color: '#626260' }}>
            {timestamp ? formatTime(timestamp) : ''}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
          <span
            style={{
              fontSize: 13.5,
              color: '#9C9C9A',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 200,
            }}
          >
            <MessageListPreviewLine preview={preview} />
          </span>
          {unread > 0 ? <span className="unread-badge">{unread}</span> : null}
        </div>
      </div>
    </button>
  );
}

export function ChatDeleteActionSheet({
  open,
  onClose,
  onDelete,
  clearOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  clearOnly?: boolean;
}) {
  if (!open) return null;

  return createPortal(
    <div className="attach-sheet-backdrop fade-in" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="attach-sheet-group" role="dialog" aria-modal="true" aria-label="Chat actions">
          <button
            type="button"
            className="attach-sheet-row attach-sheet-row--icon attach-sheet-row--danger attach-sheet-row-first attach-sheet-row-last"
            onClick={onDelete}
          >
            <span className="attach-sheet-row-icon" aria-hidden>
              <TrashIcon color="var(--danger)" />
            </span>
            <span className="attach-sheet-row-text">
              <span className="attach-sheet-row-label">{clearOnly ? 'Clear history' : 'Delete chat'}</span>
            </span>
          </button>
        </div>
        <button type="button" className="attach-sheet-group attach-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
