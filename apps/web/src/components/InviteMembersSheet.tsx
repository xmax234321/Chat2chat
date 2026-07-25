import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Contact, Group } from '../lib/types';
import { initials } from '../lib/types';
import { useApp } from '../store/AppContext';
import { SearchIcon } from './Icons';

type Props = {
  open: boolean;
  group: Group | null;
  onClose: () => void;
};

export function InviteMembersSheet({ open, group, onClose }: Props) {
  const { contacts, inviteToGroup } = useApp();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setBusy(false);
    }
  }, [open]);

  const pickable = useMemo(() => {
    if (!group) return [];
    const taken = new Set([...group.memberIds, ...(group.invitedIds ?? [])]);
    return contacts.filter((c) => !c.isUnknown && !taken.has(c.userId));
  }, [contacts, group]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pickable;
    return pickable.filter((c) => c.alias.toLowerCase().includes(q));
  }, [pickable, query]);

  const invite = async (userId: string) => {
    if (!group || busy) return;
    setBusy(true);
    try {
      await inviteToGroup(group.id, userId);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open || !group) return null;

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div className="create-group-sheet share-contact-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-group-sheet-top">
          <span className="create-group-nav-spacer" />
          <span className="create-group-sheet-title">Add members</span>
          <button type="button" className="create-group-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="share-contact-search create-group-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search contacts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="create-group-members share-contact-list">
          {filtered.length === 0 ? (
            <p className="create-group-empty">No contacts to invite</p>
          ) : (
            filtered.map((c: Contact) => (
              <button
                key={c.userId}
                type="button"
                className="share-contact-row create-group-member-row"
                disabled={busy}
                onClick={() => void invite(c.userId)}
              >
                <span className="share-contact-avatar avatar">{c.avatar || initials(c.alias)}</span>
                <span className="share-contact-name">{c.alias}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
