import { createPortal } from 'react-dom';
import { PlusIcon, UserIcon } from './Icons';

type Props = {
  open: boolean;
  onClose: () => void;
  onAddContact: () => void;
  onCreateGroup: () => void;
};

export function ChatCreateMenuSheet({ open, onClose, onAddContact, onCreateGroup }: Props) {
  if (!open) return null;

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="attach-sheet-group" role="dialog" aria-modal="true" aria-label="Create">
          <button
            type="button"
            className="attach-sheet-row attach-sheet-row--icon attach-sheet-row-first"
            onClick={() => {
              onAddContact();
              onClose();
            }}
          >
            <span className="attach-sheet-row-icon" aria-hidden>
              <UserIcon />
            </span>
            <span className="attach-sheet-row-text">
              <span className="attach-sheet-row-label">Add contact</span>
            </span>
          </button>
          <button
            type="button"
            className="attach-sheet-row attach-sheet-row--icon attach-sheet-row-last"
            onClick={() => {
              onCreateGroup();
              onClose();
            }}
          >
            <span className="attach-sheet-row-icon" aria-hidden>
              <PlusIcon size={20} />
            </span>
            <span className="attach-sheet-row-text">
              <span className="attach-sheet-row-label">Create group</span>
            </span>
          </button>
        </div>
        <button type="button" className="attach-sheet-group attach-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
