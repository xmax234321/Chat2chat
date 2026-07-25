import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  contactName: string;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
};

export function DeleteChatSheet({
  open,
  contactName,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete chat',
}: Props) {
  if (!open) return null;

  const dialogTitle = title ?? `Delete chat with ${contactName}?`;
  const dialogMessage =
    message ?? 'Messages will be removed from this device. The contact can message you again.';

  return createPortal(
    <div className="attach-sheet-backdrop fade-in" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="delete-chat-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-chat-title">
          <p id="delete-chat-title" className="delete-chat-title">
            {dialogTitle}
          </p>
          <p className="delete-chat-subtitle">{dialogMessage}</p>
          <button type="button" className="attach-sheet-row attach-sheet-row--danger attach-sheet-row-first attach-sheet-row-last" onClick={onConfirm}>
            {confirmLabel}
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
