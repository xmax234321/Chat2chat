import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { contactDisplayName } from '../lib/types';
import { useApp } from '../store/AppContext';
import { useToast } from './Toast';

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ContactHeaderTitle({
  contactId,
  className,
}: {
  contactId: string;
  className?: string;
}) {
  const { getContact, renameContact, skipContactNaming } = useApp();
  const { show } = useToast();
  const contact = getContact(contactId);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [name, setName] = useState('');

  const isUnknown = Boolean(contact?.isUnknown);

  useEffect(() => {
    if (isUnknown) setUnknownOpen(true);
  }, [contactId, isUnknown]);

  useEffect(() => {
    if (!unknownOpen || !isUnknown) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [unknownOpen, isUnknown]);

  if (!contact) return null;
  const label = contactDisplayName(contact);

  const saveUnknown = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      show('Enter a name');
      return;
    }
    renameContact(contactId, trimmed);
    setUnknownOpen(false);
    show('Contact saved');
  };

  const skipUnknown = () => {
    skipContactNaming(contactId);
    setUnknownOpen(false);
  };

  const unknownOverlay =
    unknownOpen && isUnknown
      ? createPortal(
          <div className="contact-label-screen" role="dialog" aria-modal="true" aria-label="Name this contact">
            <div className="contact-label-screen-inner centered-content">
              <div className="avatar contact-label-avatar">?</div>
              <h2 className="contact-label-title">Who is this?</h2>
              <p className="subtitle contact-label-subtitle">
                Enter a name for this contact. Only you will see it on this device.
              </p>
              <input
                className="input-field contact-label-input"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveUnknown();
                }}
                autoFocus
              />
              <button type="button" className="btn-primary contact-label-save" onClick={saveUnknown}>
                Save name
              </button>
              <button type="button" className="btn-ghost contact-label-skip" onClick={skipUnknown}>
                Skip for now
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`contact-header-title${className ? ` ${className}` : ''}`}>
        {isUnknown ? (
          <button
            type="button"
            className="contact-name-trigger contact-name-trigger--unknown"
            onClick={() => setUnknownOpen(true)}
            aria-expanded={unknownOpen}
            aria-haspopup="dialog"
          >
            <span>{label}</span>
            <ChevronDown />
          </button>
        ) : (
          <span className="contact-name-text">{label}</span>
        )}
      </div>
      {unknownOverlay}
    </>
  );
}
