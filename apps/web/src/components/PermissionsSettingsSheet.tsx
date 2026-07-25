import { createPortal } from 'react-dom';
import { PermissionsSettingsContent } from './PermissionsSettingsContent';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PermissionsSettingsSheet({ open, onClose }: Props) {
  if (!open) return null;

  return createPortal(
    <div className="permission-menu-backdrop" onClick={onClose} role="presentation">
      <div className="permission-menu-sheet sheet-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="share-contact-handle" aria-hidden />
        <h2 className="permission-menu-title">Permissions</h2>
        <PermissionsSettingsContent active />
      </div>
    </div>,
    document.body,
  );
}
