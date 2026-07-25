import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Contact } from '../lib/types';
import { isSavedMessagesContact } from '../lib/saved-messages';
import { useApp, useChatPreviews } from '../store/AppContext';
import { ChatDeleteActionSheet, ChatListRow } from './ChatListRow';
import { DeleteChatSheet } from './DeleteChatSheet';

export function ChatSidebar({
  selectedId,
  basePath,
}: {
  selectedId?: string;
  basePath: '/chat' | '/app';
}) {
  const navigate = useNavigate();
  const { deleteChat } = useApp();
  const previews = useChatPreviews();
  const [query, setQuery] = useState('');
  const [menuContact, setMenuContact] = useState<Contact | null>(null);
  const [confirmContact, setConfirmContact] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return previews;
    return previews.filter((p) => p.contact.alias.toLowerCase().includes(q));
  }, [previews, query]);

  const confirmDelete = () => {
    if (!confirmContact) return;
    const id = confirmContact.userId;
    deleteChat(id);
    setConfirmContact(null);
    if (selectedId === id) navigate(basePath);
  };

  return (
    <>
      <div className="desktop-sidebar-header">
        <h1>Chats</h1>
      </div>
      <div className="search-box desktop-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5F5F5D" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="desktop-chat-list">
        {filtered.length === 0 ? (
          <div className="desktop-empty-hint">No chats yet. Add a contact to start.</div>
        ) : (
          filtered.map(({ contact, preview, timestamp }) => (
            <ChatListRow
              key={contact.userId}
              contact={contact}
              preview={preview}
              timestamp={timestamp}
              active={selectedId === contact.userId}
              variant="desktop"
              onOpen={() => navigate(`${basePath}/${encodeURIComponent(contact.userId)}`)}
              onDeleteRequest={setMenuContact}
            />
          ))
        )}
      </div>
      <button type="button" className="desktop-add-btn" onClick={() => navigate('/add-contact')}>
        + New contact
      </button>
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
    </>
  );
}

export function ChatListBody({ onSelect }: { onSelect: (id: string) => void }) {
  const { deleteChat } = useApp();
  const previews = useChatPreviews();
  const [query, setQuery] = useState('');
  const [menuContact, setMenuContact] = useState<Contact | null>(null);
  const [confirmContact, setConfirmContact] = useState<Contact | null>(null);

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
    <>
      <div className="screen-pad-sm">
        <div className="chat-list-header">
          <h1 className="title">Chats</h1>
          <div className="chat-list-header-actions">
            <button type="button" className="icon-btn" onClick={() => onSelect('__add__')} aria-label="Add contact">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5F5F5D" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="screen-body">
        {filtered.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: '#9C9C9A', fontSize: 14 }}>
            No chats yet. Tap + to add a contact.
          </div>
        ) : (
          filtered.map(({ contact, preview, timestamp }) => (
            <ChatListRow
              key={contact.userId}
              contact={contact}
              preview={preview}
              timestamp={timestamp}
              onOpen={() => onSelect(contact.userId)}
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
    </>
  );
}

export function useChatListNavigate() {
  const navigate = useNavigate();
  const { connected } = useApp();
  return { navigate, connected };
}
