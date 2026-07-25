import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Contact } from '../lib/types';
import { initials } from '../lib/types';
import { useApp } from '../store/AppContext';
import { isSavedMessagesContact } from '../lib/saved-messages';
import { BackIcon, SearchIcon } from './Icons';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateGroupSheet({ open, onClose }: Props) {
  const { contacts, createGroup } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setQuery('');
      setSelected(new Set());
      setBusy(false);
    }
  }, [open]);

  const pickable = useMemo(
    () => contacts.filter((c) => !c.isUnknown && !isSavedMessagesContact(c)),
    [contacts],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pickable;
    return pickable.filter((c) => c.alias.toLowerCase().includes(q));
  }, [pickable, query]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const close = () => {
    onClose();
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await createGroup(trimmed, [...selected]);
      close();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="share-contact-backdrop" onClick={close} role="presentation">
      <div className="create-group-sheet share-contact-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-group-sheet-top">
          {step === 2 ? (
            <button type="button" className="create-group-nav-btn" onClick={() => setStep(1)} aria-label="Back">
              <BackIcon />
            </button>
          ) : (
            <span className="create-group-nav-spacer" />
          )}
          <span className="create-group-sheet-title">{step === 1 ? 'Invite people' : 'Group name'}</span>
          <button type="button" className="create-group-close-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {step === 1 ? (
          <>
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
                <p className="create-group-empty">No contacts yet — you can add members later.</p>
              ) : (
                filtered.map((c: Contact) => (
                  <button
                    key={c.userId}
                    type="button"
                    className={`share-contact-row create-group-member-row${selected.has(c.userId) ? ' create-group-member-row--on' : ''}`}
                    onClick={() => toggle(c.userId)}
                  >
                    <span className="share-contact-avatar avatar">{c.avatar || initials(c.alias)}</span>
                    <span className="share-contact-name">{c.alias}</span>
                    <span className="create-group-check">{selected.has(c.userId) ? '✓' : ''}</span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              className="btn-primary create-group-next-btn"
              onClick={() => setStep(2)}
            >
              {selected.size > 0 ? `Next · ${selected.size} selected` : 'Next'}
            </button>
          </>
        ) : (
          <>
            <p className="create-group-step-hint">Name your group — invites will appear in Activity.</p>
            <input
              className="create-group-name-input"
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={48}
              autoFocus
            />
            <button
              type="button"
              className="btn-primary create-group-next-btn"
              disabled={!name.trim() || busy}
              onClick={() => void submit()}
            >
              {busy ? 'Creating…' : 'Create group'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
