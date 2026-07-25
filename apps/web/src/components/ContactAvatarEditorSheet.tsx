import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const AVATAR_CHOICES = [
  '😀', '😎', '🦊', '🐼', '🦁', '🐯', '🐸', '🦄',
  '🌟', '🔥', '💎', '🎯', '🎨', '🎵', '⚡️', '🌈',
  '🍀', '🌊', '🌙', '☀️', '🚀', '🛸', '🎮', '📎',
];

type Props = {
  open: boolean;
  current: string;
  onClose: () => void;
  onSave: (avatar: string) => void;
};

export function ContactAvatarEditorSheet({ open, current, onClose, onSave }: Props) {
  const [picked, setPicked] = useState(current);

  useEffect(() => {
    if (open) setPicked(current);
  }, [current, open]);

  if (!open) return null;

  return createPortal(
    <div className="contact-rename-backdrop" onClick={onClose} role="presentation">
      <div className="contact-rename-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="contact-rename-title">Choose avatar</div>
        <div className="contact-avatar-grid">
          {AVATAR_CHOICES.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`contact-avatar-choice${picked === emoji ? ' contact-avatar-choice--on' : ''}`}
              onClick={() => setPicked(emoji)}
              aria-label={`Avatar ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="contact-rename-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onSave(picked);
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
