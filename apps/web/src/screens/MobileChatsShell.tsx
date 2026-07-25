import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router-dom';
import { ConversationScreen, type ConversationMode } from './Conversation';
import { isMobileShell } from '../lib/platform';
import { primeMobileChat, readLastMobileChatId, subscribeMobileChatWarm } from '../lib/mobile-chat-warm';

export function MobileChatsShell() {
  const location = useLocation();
  const chatMatch = useMatch('/chat/:contactId');
  const profileContactMatch = useMatch('/contact/:contactId/profile');
  const profileGroupMatch = useMatch('/group/:groupId/profile');

  const routeContactId = useMemo(() => {
    if (chatMatch?.params.contactId) return decodeURIComponent(chatMatch.params.contactId);
    if (profileContactMatch?.params.contactId) return decodeURIComponent(profileContactMatch.params.contactId);
    if (profileGroupMatch?.params.groupId) return decodeURIComponent(profileGroupMatch.params.groupId);
    return null;
  }, [chatMatch, profileContactMatch, profileGroupMatch]);

  const [mountedId, setMountedId] = useState<string | null>(() => routeContactId ?? readLastMobileChatId());
  const [primedId, setPrimedId] = useState<string | null>(null);

  useEffect(() => subscribeMobileChatWarm(setPrimedId), []);

  useEffect(() => {
    if (primedId) setMountedId(primedId);
  }, [primedId]);

  useEffect(() => {
    if (routeContactId) {
      setMountedId(routeContactId);
      primeMobileChat(routeContactId);
    }
  }, [routeContactId]);

  const onList = location.pathname === '/chats';
  const onChat = Boolean(chatMatch);
  const onProfile = Boolean(profileContactMatch || profileGroupMatch);

  const persistId = mountedId ?? primedId;

  const conversationMode: ConversationMode | null = persistId
    ? onChat
      ? 'active'
      : onProfile
        ? 'under'
        : onList
          ? 'cached'
          : null
    : null;

  if (!isMobileShell()) {
    return <Outlet />;
  }

  return (
    <div className="mobile-chats-shell">
      {persistId && conversationMode ? (
        <div className={`mobile-chat-persist mobile-chat-persist--${conversationMode}`}>
          <ConversationScreen contactId={persistId} mode={conversationMode} />
        </div>
      ) : null}
      <div
        className={`mobile-chats-route${onChat ? ' mobile-chats-route--hidden' : ''}${onProfile ? ' mobile-chats-route--overlay' : ''}`}
      >
        <Outlet />
      </div>
    </div>
  );
}
