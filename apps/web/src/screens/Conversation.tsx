import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PhoneShell } from '../components/PhoneShell';
import { BackIcon, PhoneIcon, ShieldIcon } from '../components/Icons';
import { ContactAvatar } from '../components/ContactAvatar';
import { InCallBanner } from '../components/calls/InCallBanner';
import { ChatMessageList, ChatSelectionBar, type ChatMessageListHandle } from '../components/ChatMessageList';
import { ContactHeaderTitle } from '../components/ContactHeaderTitle';
import { ContactVersionBanner } from '../components/ContactVersionBanner';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { useCalls } from '../store/CallContext';
import { useChatInputFocus } from '../hooks/useChatInputFocus';
import { useChatScroll } from '../hooks/useChatScroll';
import { useSwipeToClose } from '../hooks/useSwipeToClose';
import { ScrollToBottomButton } from '../components/ScrollToBottomButton';
import { ChatMessageComposer } from '../components/ChatMessageComposer';
import { CALLS_ENABLED } from '../lib/calls-feature';
import type { PickedMedia } from '../lib/pick-media';
import { isGroupId } from '../lib/types';
import { isSavedMessagesContact } from '../lib/saved-messages';
import { ChatWallpaperBackground } from '../components/ChatWallpaperBackground';
import { ChatWallpaperChrome } from '../components/ChatWallpaperChrome';
import type { MessageReplyRef } from '../lib/message-reply';

export type ConversationMode = 'active' | 'cached' | 'under';

export function ConversationScreen({
  contactId: contactIdProp,
  mode = 'active',
}: {
  contactId?: string;
  mode?: ConversationMode;
} = {}) {
  const { contactId: rawId } = useParams();
  const contactId = contactIdProp ?? decodeURIComponent(rawId ?? '');
  const isActive = mode === 'active';
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightMessageId = isActive ? searchParams.get('msg') : null;
  const navigate = useNavigate();
  const {
    getContact,
    getGroup,
    getThread,
    sendText,
    sendMedia,
    cancelUpload,
    setActiveChatContact,
    markGroupMessageViewed,
    signalMediaGroupSent,
  } = useApp();
  const { activeCall, startCall } = useCalls();
  const { show } = useToast();
  const contact = getContact(contactId);
  const group = isGroupId(contactId) ? getGroup(contactId) : undefined;
  const displayContact = contact ?? (group ? {
    userId: group.id,
    fingerprint: '',
    alias: group.name,
    verified: false,
    avatar: group.avatar,
  } : undefined);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [replyTo, setReplyTo] = useState<MessageReplyRef | null>(null);
  const messageListRef = useRef<ChatMessageListHandle>(null);
  const groupViewedRef = useRef<Set<string>>(new Set());
  const thread = getThread(contactId);
  const minimizedCall =
    activeCall?.minimized && activeCall.phase === 'active' && activeCall.contactId === contactId
      ? activeCall
      : null;
  const { messagesRef, showScrollDown, scrollToBottom } = useChatScroll(thread.length, contactId, {
    enabled: isActive,
    prepareOnly: mode === 'cached',
  });
  const onInputFocus = useChatInputFocus(messagesRef);
  const swipeClose = useSwipeToClose({
    enabled: isActive && !selectionMode,
    onClose: () => navigate('/chats'),
    blockWhen: () => selectionMode,
  });

  useEffect(() => {
    if (!isActive) return;
    setActiveChatContact(contactId);
    return () => setActiveChatContact(null);
  }, [contactId, isActive, setActiveChatContact]);

  useEffect(() => {
    setReplyTo(null);
  }, [contactId]);

  useEffect(() => {
    groupViewedRef.current = new Set();
  }, [contactId]);

  useEffect(() => {
    if (!isActive || !group) return;
    for (const message of thread) {
      if (message.direction !== 'in') continue;
      if (groupViewedRef.current.has(message.id)) continue;
      groupViewedRef.current.add(message.id);
      markGroupMessageViewed(group.id, message.id);
    }
  }, [group, isActive, markGroupMessageViewed, thread]);

  const sendPicked = async (picked: PickedMedia) => {
    await sendMedia(contactId, picked);
  };

  if (!displayContact) {
    return (
      <PhoneShell>
        <div className="screen-pad">{isGroupId(contactId) ? 'Group not found' : 'Contact not found'}</div>
      </PhoneShell>
    );
  }

  const isGroup = Boolean(group);

  return (
    <PhoneShell showHome={false}>
      <div
        className={`chat-screen${isActive ? '' : ' chat-screen--persisted'}${swipeClose.dragging ? ' chat-screen--swiping' : ''}`}
        style={isActive ? swipeClose.style : undefined}
        onTouchStart={isActive ? swipeClose.onTouchStart : undefined}
        onTouchMove={isActive ? swipeClose.onTouchMove : undefined}
        onTouchEnd={isActive ? swipeClose.onTouchEnd : undefined}
      >
      <ChatWallpaperChrome>
      {CALLS_ENABLED && minimizedCall && contact && (
        <InCallBanner call={minimizedCall} contact={contact} />
      )}
      <div className="chat-header">
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
        <button type="button" className="nav-back" onClick={() => navigate('/chats')}>
          <BackIcon />
        </button>
        <button
          type="button"
          className="chat-header-profile-hit"
          onClick={() => {
            if (isGroup) navigate(`/group/${encodeURIComponent(contactId)}/profile`);
            else navigate(`/contact/${encodeURIComponent(contactId)}/profile`);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit' }}
        >
          <ContactAvatar contact={displayContact} size={38} iconSize={17} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {isGroup ? (
              <div style={{ fontSize: 16, fontWeight: 600, color: '#F4F4F3' }}>{displayContact.alias}</div>
            ) : (
              <ContactHeaderTitle contactId={contactId} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7FB88A', marginTop: 2 }}>
              {!isGroup && isSavedMessagesContact(displayContact) ? (
                <span>notes to self</span>
              ) : (
                <>
                  <ShieldIcon />
                  {isGroup
                    ? `${group?.memberIds.length ?? 0} members · encrypted`
                    : contact?.verified
                      ? 'End-to-end encrypted · verified'
                      : 'End-to-end encrypted'}
                </>
              )}
            </div>
          </div>
        </button>
        {!isGroup && !contact?.verified && !isSavedMessagesContact(displayContact) && (
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
            onClick={() => navigate(`/verify/${encodeURIComponent(contactId)}`)}
          >
            Verify
          </button>
        )}
        {CALLS_ENABLED && !isGroup && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => startCall(contactId)}
            aria-label="Call"
            style={{ marginLeft: contact?.verified ? 0 : 8 }}
          >
            <PhoneIcon />
          </button>
        )}
          </>
        )}
      </div>

      {contact && isActive && <ContactVersionBanner contact={contact} />}

      <div className="chat-messages-wrap">
        <ChatWallpaperBackground />
        <div className="screen-body msg-list" ref={messagesRef}>
          {isActive ? (
            <>
          <div style={{ textAlign: 'center', font: "500 10px 'JetBrains Mono', monospace", color: '#626260', marginBottom: 8 }}>
            TODAY
          </div>
          <ChatMessageList
            ref={messageListRef}
            thread={thread}
            contactId={contactId}
            contactAlias={displayContact.alias}
            isGroup={isGroup}
            cancelUpload={cancelUpload}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onSelectionModeChange={setSelectionMode}
            onSelectedIdsChange={setSelectedIds}
            onReply={setReplyTo}
            highlightMessageId={highlightMessageId}
            onHighlightDone={() => {
              if (!searchParams.has('msg')) return;
              const next = new URLSearchParams(searchParams);
              next.delete('msg');
              setSearchParams(next, { replace: true });
            }}
          />
            </>
          ) : null}
        </div>
        <ScrollToBottomButton visible={isActive && showScrollDown} onClick={() => scrollToBottom(true)} />
      </div>

      <ChatMessageComposer
        chatId={contactId}
        disabled={!isActive || selectionMode}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSendText={(body, reply) => sendText(contactId, body, reply)}
        onSendMedia={sendPicked}
        onError={(msg) => show(msg)}
        onInputFocus={onInputFocus}
        onBatchSent={signalMediaGroupSent}
      />
      </ChatWallpaperChrome>
      </div>
    </PhoneShell>
  );
}
