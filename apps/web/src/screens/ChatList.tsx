import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStatusLive } from '../hooks/useConnectionStatusLive';
import { PhoneShell } from '../components/PhoneShell';
import { SearchIcon, BellIcon, PlusIcon, UserIcon } from '../components/Icons';
import { ConnectionStatusBar } from '../components/ConnectionStatusBar';
import { PhoneTabBar } from '../components/PhoneTabBar';
import { ChatDeleteActionSheet, ChatListRow } from '../components/ChatListRow';
import { DeleteChatSheet } from '../components/DeleteChatSheet';
import { NotificationsSheet } from '../components/NotificationsSheet';
import { CreateGroupSheet } from '../components/CreateGroupSheet';
import { ChatCreateMenuSheet } from '../components/ChatCreateMenuSheet';
import { useApp, useChatPreviews } from '../store/AppContext';
import type { Contact } from '../lib/types';
import { isSavedMessagesContact } from '../lib/saved-messages';
import { isMobileShell } from '../lib/platform';
import { primeMobileChat, readLastMobileChatId } from '../lib/mobile-chat-warm';

export function ChatListScreen() {
  const navigate = useNavigate();
  useConnectionStatusLive();
  const { deleteChat, unreadNotificationCount } = useApp();
  const previews = useChatPreviews();
  const [query, setQuery] = useState('');
  const [menuContact, setMenuContact] = useState<Contact | null>(null);
  const [confirmContact, setConfirmContact] = useState<Contact | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileShell()) return;
    const lastId = readLastMobileChatId();
    if (lastId) primeMobileChat(lastId);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return previews;
    return previews.filter((p) => p.contact.alias.toLowerCase().includes(q));
  }, [previews, query]);

  const confirmDelete = () => {
    if (!confirmContact) return;
    deleteChat(confirmContact.userId);
    setConfirmContact(null);
  };

  return (
    <PhoneShell>
      <div className="screen-pad-sm">
        <div className="chat-list-header chat-list-header-with-status">
          <h1 className="title">Chats</h1>
          <ConnectionStatusBar className="connection-status-bar--header" />
          <div className="chat-list-header-actions">
            <button
              type="button"
              className="icon-btn activity-icon-btn"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Activity"
            >
              <BellIcon size={17} />
              {unreadNotificationCount > 0 ? (
                <span className="activity-icon-badge">{Math.min(unreadNotificationCount, 9)}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setCreateMenuOpen(true)}
              aria-label="Create chat or add contact"
            >
              <PlusIcon size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={() => navigate('/settings')} aria-label="Settings">
              <UserIcon />
            </button>
          </div>
        </div>
        <div className="search-box">
          <SearchIcon />
          <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="screen-body scroll-area">
        {filtered.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: '#9C9C9A', fontSize: 14 }}>
            No chats yet. Tap + to add a contact or create a group.
          </div>
        ) : (
          filtered.map(({ contact, preview, timestamp, unread }) => (
            <ChatListRow
              key={contact.userId}
              contact={contact}
              preview={preview}
              timestamp={timestamp}
              unread={unread}
              onOpen={() => navigate(`/chat/${encodeURIComponent(contact.userId)}`)}
              onPrimeOpen={() => {
                if (isMobileShell()) primeMobileChat(contact.userId);
              }}
              onDeleteRequest={setMenuContact}
            />
          ))
        )}
      </div>

      <ChatDeleteActionSheet
        open={menuContact != null && !isSavedMessagesContact(menuContact)}
        onClose={() => setMenuContact(null)}
        onDelete={() => {
          setConfirmContact(menuContact);
          setMenuContact(null);
        }}
      />
      <DeleteChatSheet
        open={confirmContact != null && !isSavedMessagesContact(confirmContact)}
        contactName={confirmContact?.alias ?? ''}
        onClose={() => setConfirmContact(null)}
        onConfirm={confirmDelete}
      />
      <NotificationsSheet open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <CreateGroupSheet open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
      <ChatCreateMenuSheet
        open={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        onAddContact={() => navigate('/add-contact')}
        onCreateGroup={() => setCreateGroupOpen(true)}
      />

      <PhoneTabBar />
    </PhoneShell>
  );
}
