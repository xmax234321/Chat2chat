import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon } from './Icons';
import { isMobileShell } from '../lib/platform';
import { isSavedMessagesId, SAVED_MESSAGES_ALIAS } from '../lib/saved-messages';
import { SfBookmarkIcon } from './settings/SettingsSfIcons';

export type ShareTarget = {
  id: string;
  name: string;
  avatar: string;
  isGroup?: boolean;
};

export function ShareContactSheet({
  open,
  contacts,
  groups = [],
  onClose,
  onPick,
  onExternalShare,
}: {
  open: boolean;
  contacts: ShareTarget[];
  groups?: ShareTarget[];
  onClose: () => void;
  onPick: (targetId: string) => void;
  onExternalShare?: () => void;
}) {
  const [query, setQuery] = useState('');
  const shouldAutofocusSearch = !isMobileShell();

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [contacts, query]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
  }, [groups, query]);

  if (!open) return null;

  const empty = filteredContacts.length === 0 && filteredGroups.length === 0;

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div className="share-contact-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="share-contact-handle" aria-hidden />
        <div className="share-contact-title">Share to</div>
        {onExternalShare && (
          <button
            type="button"
            className="share-contact-row share-contact-external"
            onClick={() => {
              onExternalShare();
              onClose();
            }}
          >
            <span className="share-contact-external-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                <path d="M16 6l-4-4-4 4" />
                <path d="M12 2v13" />
              </svg>
            </span>
            <span className="share-contact-name">Share to other apps</span>
          </button>
        )}
        <div className="share-contact-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={shouldAutofocusSearch}
          />
        </div>
        <div className="share-contact-list">
          {empty && <div className="share-contact-empty">No chats found</div>}
          {filteredGroups.length > 0 && (
            <>
              <div className="share-contact-section-label">Groups</div>
              {filteredGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="share-contact-row"
                  onClick={() => {
                    onPick(g.id);
                    onClose();
                  }}
                >
                  <span className="avatar share-contact-avatar">{g.avatar}</span>
                  <span className="share-contact-name">{g.name}</span>
                </button>
              ))}
            </>
          )}
          {filteredContacts.length > 0 && (
            <>
              <div className="share-contact-section-label">Contacts</div>
              {filteredContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`share-contact-row${isSavedMessagesId(c.id) ? ' share-contact-row--saved' : ''}`}
                  onClick={() => {
                    onPick(c.id);
                    onClose();
                  }}
                >
                  {isSavedMessagesId(c.id) ? (
                    <>
                      <span className="avatar share-contact-avatar avatar--saved-messages">
                        <SfBookmarkIcon size={18} color="#5eb3ff" />
                      </span>
                      <span className="share-contact-name">{SAVED_MESSAGES_ALIAS}</span>
                    </>
                  ) : (
                    <>
                      <span className="avatar share-contact-avatar">{c.avatar}</span>
                      <span className="share-contact-name">{c.name}</span>
                    </>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
