import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Group } from '../lib/types';
import { initials } from '../lib/types';
import { useApp } from '../store/AppContext';
import { SearchIcon } from './Icons';

type Props = {
  open: boolean;
  contactId: string;
  onClose: () => void;
  onInvited?: () => void;
};

export function InviteContactToGroupSheet({ open, contactId, onClose, onInvited }: Props) {
  const { groups, identity, inviteToGroup } = useApp();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setBusy(false);
    }
  }, [open]);

  const pickable = useMemo(() => {
    if (!identity) return [];
    return groups.filter((g) => {
      if (g.adminId !== identity.userId) return false;
      if (g.memberIds.includes(contactId)) return false;
      if (g.invitedIds?.includes(contactId)) return false;
      return true;
    });
  }, [contactId, groups, identity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pickable;
    return pickable.filter((g) => g.name.toLowerCase().includes(q));
  }, [pickable, query]);

  const invite = async (group: Group) => {
    if (busy) return;
    setBusy(true);
    try {
      await inviteToGroup(group.id, contactId);
      onInvited?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div
        className="create-group-sheet share-contact-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add to group"
      >
        <div className="create-group-sheet-top">
          <span className="create-group-nav-spacer" />
          <span className="create-group-sheet-title">Add to group</span>
          <button type="button" className="create-group-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="share-contact-search create-group-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search groups"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="create-group-members share-contact-list">
          {filtered.length === 0 ? (
            <p className="create-group-empty">
              {pickable.length === 0 ? 'No groups to invite to' : 'No groups match your search'}
            </p>
          ) : (
            filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                className="share-contact-row create-group-member-row"
                disabled={busy}
                onClick={() => void invite(g)}
              >
                <span className="share-contact-avatar avatar">{g.avatar || initials(g.name)}</span>
                <span className="share-contact-name">{g.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
