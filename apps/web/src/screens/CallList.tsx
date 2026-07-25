import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PhoneShell } from '../components/PhoneShell';
import { LockIcon, PlusIcon, SearchIcon } from '../components/Icons';
import { CallListRow } from '../components/calls/CallListRow';
import { ConnectionStatusBar } from '../components/ConnectionStatusBar';
import { PhoneTabBar } from '../components/PhoneTabBar';
import { useApp } from '../store/AppContext';
import { useCalls } from '../store/CallContext';
import { useConnectionStatusLive } from '../hooks/useConnectionStatusLive';
import { isMobileShell } from '../lib/platform';

function NewCallSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (contactId: string) => void;
}) {
  const { contacts } = useApp();
  const [query, setQuery] = useState('');
  const shouldAutofocusSearch = !isMobileShell();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.alias.toLowerCase().includes(q));
  }, [contacts, query]);

  if (!open) return null;

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div className="share-contact-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="share-contact-handle" aria-hidden />
        <div className="share-contact-title">New call</div>
        <div className="share-contact-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search contacts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={shouldAutofocusSearch}
          />
        </div>
        <div className="share-contact-list">
          {filtered.length === 0 && <div className="share-contact-empty">No contacts found</div>}
          {filtered.map((c) => (
            <button
              key={c.userId}
              type="button"
              className="share-contact-row"
              onClick={() => {
                onPick(c.userId);
                onClose();
              }}
            >
              <span className="avatar share-contact-avatar">{c.avatar}</span>
              <span className="share-contact-name">{c.alias}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CallListScreen() {
  useConnectionStatusLive();
  const { contacts, getContact } = useApp();
  const { callHistory, startCall } = useCalls();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <PhoneShell>
      <div className="screen-pad-sm">
        <div className="chat-list-header chat-list-header-with-status">
          <h1 className="title">Calls</h1>
          <ConnectionStatusBar className="connection-status-bar--header" />
          <div className="chat-list-header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSheetOpen(true)}
              aria-label="New call"
              disabled={contacts.length === 0}
            >
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="screen-body scroll-area call-list-body">
        {callHistory.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: '#9C9C9A', fontSize: 14 }}>
            No calls yet. Tap + to call a contact.
          </div>
        ) : (
          callHistory.map((record) => (
            <CallListRow
              key={record.id}
              record={record}
              contact={getContact(record.contactId)}
              onCall={() => startCall(record.contactId)}
            />
          ))
        )}
      </div>

      <div className="call-list-footer">
        <LockIcon size={11} color="#5F5F5D" />
        Calls are end-to-end encrypted
      </div>

      <PhoneTabBar />

      <NewCallSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={(contactId) => startCall(contactId)}
      />
    </PhoneShell>
  );
}
