import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon, ShieldIcon } from './Icons';
import { ContactAvatar } from './ContactAvatar';
import { ChatMessageList, ChatSelectionBar, type ChatMessageListHandle } from './ChatMessageList';
import { ContactHeaderTitle } from './ContactHeaderTitle';
import { ContactVersionBanner } from './ContactVersionBanner';
import { useToast } from './Toast';
import { useApp } from '../store/AppContext';
import { useChatInputFocus } from '../hooks/useChatInputFocus';
import { useChatScroll } from '../hooks/useChatScroll';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { ChatMessageComposer } from './ChatMessageComposer';
import type { PickedMedia } from '../lib/pick-media';
import { isSavedMessagesContact } from '../lib/saved-messages';
import { ChatWallpaperBackground } from './ChatWallpaperBackground';
import { ChatWallpaperChrome } from './ChatWallpaperChrome';
import type { MessageReplyRef } from '../lib/message-reply';
import { contactDisplayName } from '../lib/types';

export function ChatPanel({
  contactId,
  showBack = false,
  backTo,
}: {
  contactId: string;
  showBack?: boolean;
  backTo?: string;
}) {
  const navigate = useNavigate();
  const { getContact, getThread, sendText, sendMedia, cancelUpload, setActiveChatContact } = useApp();
  const { show } = useToast();
  const contact = getContact(contactId);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [replyTo, setReplyTo] = useState<MessageReplyRef | null>(null);
  const messageListRef = useRef<ChatMessageListHandle>(null);
  const thread = getThread(contactId);
  const { messagesRef, showScrollDown, scrollToBottom } = useChatScroll(thread.length, contactId);
  const onInputFocus = useChatInputFocus(messagesRef);

  useEffect(() => {
    setActiveChatContact(contactId);
    return () => setActiveChatContact(null);
  }, [contactId, setActiveChatContact]);

  useEffect(() => {
    setReplyTo(null);
  }, [contactId]);

  const sendPicked = async (picked: PickedMedia) => {
    await sendMedia(contactId, picked);
  };

  if (!contact) {
    return (
      <div className="chat-panel-empty">
        <p>Contact not found</p>
        {showBack && (
          <button type="button" className="btn-secondary" style={{ marginTop: 16, width: 'auto' }} onClick={() => navigate(backTo ?? '/chats')}>
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <ChatWallpaperChrome>
    <div className="chat-panel">
      <div className="chat-panel-header">
        {selectionMode ? (
          <ChatSelectionBar
            count={selectedIds.size}
            onCancel={() => {
              setSelectionMode(false);
              setSelectedIds(new Set());
            }}
            onForward={() => messageListRef.current?.forwardSelection()}
          />
        ) : (
          <>
        {showBack && (
          <button type="button" className="nav-back" onClick={() => navigate(backTo ?? '/chats')}>
            <BackIcon />
          </button>
        )}
        <button
          type="button"
          className="chat-header-profile-hit"
          onClick={() => navigate(`/contact/${encodeURIComponent(contactId)}/profile`)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit' }}
        >
        <ContactAvatar contact={contact} size={38} iconSize={17} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ContactHeaderTitle contactId={contactId} />
          <div className="chat-panel-status">
            {isSavedMessagesContact(contact) ? (
              <span>notes to self</span>
            ) : (
              <>
                <ShieldIcon />
                {contact.verified ? 'End-to-end encrypted · verified' : 'End-to-end encrypted'}
              </>
            )}
          </div>
        </div>
        </button>
        {!contact.verified && !isSavedMessagesContact(contact) && (
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
            onClick={() => navigate(`/verify/${encodeURIComponent(contactId)}`)}
          >
            Verify
          </button>
        )}
          </>
        )}
      </div>

      <ContactVersionBanner contact={contact} />

      <div className="chat-messages-wrap">
        <div className="chat-panel-messages-wrap">
          <ChatWallpaperBackground />
          <div className="chat-panel-messages msg-list" ref={messagesRef}>
          <div className="chat-day-label">TODAY</div>
          {thread.length === 0 && (
            <div className="chat-panel-empty-hint">Send a message — it&apos;s encrypted end-to-end.</div>
          )}
          <ChatMessageList
            ref={messageListRef}
            thread={thread}
            contactId={contactId}
            contactAlias={contactDisplayName(contact)}
            cancelUpload={cancelUpload}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onSelectionModeChange={setSelectionMode}
            onSelectedIdsChange={setSelectedIds}
            onReply={setReplyTo}
          />
          </div>
        </div>
        <ScrollToBottomButton visible={showScrollDown} onClick={() => scrollToBottom(true)} />
      </div>

      <ChatMessageComposer
        chatId={contactId}
        disabled={selectionMode}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSendText={(body, reply) => sendText(contactId, body, reply)}
        onSendMedia={sendPicked}
        onError={(msg) => show(msg)}
        onInputFocus={onInputFocus}
      />
    </div>
    </ChatWallpaperChrome>
  );
}
