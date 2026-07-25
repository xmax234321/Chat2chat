import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function ContactRenameSheet({
  open,
  initialName,
  title = 'Rename contact',
  onClose,
  onSave,
}: {
  open: boolean;
  initialName: string;
  title?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyboard = () => {
      const input = document.querySelector<HTMLInputElement>('.contact-rename-input');
      if (input && document.activeElement === input) {
        requestAnimationFrame(() => input.scrollIntoView({ block: 'center', behavior: 'auto' }));
      }
    };
    window.addEventListener('keyboard-inset-change', onKeyboard);
    return () => window.removeEventListener('keyboard-inset-change', onKeyboard);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="contact-rename-backdrop" onClick={onClose} role="presentation">
      <div className="contact-rename-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="contact-rename-title">{title}</div>
        <input
          className="input-field contact-rename-input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(name);
          }}
          autoFocus
        />
        <div className="contact-rename-actions">
          <button type="button" className="btn-ghost contact-rename-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary contact-rename-btn" onClick={() => onSave(name)}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
