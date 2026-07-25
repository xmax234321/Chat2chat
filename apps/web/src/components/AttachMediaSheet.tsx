import type { ReactNode } from 'react';
import {
  AttachCameraIcon,
  AttachFileIcon,
  AttachPhotoIcon,
} from './Icons';

type Row = {
  label: string;
  hint?: string;
  icon: ReactNode;
  onClick: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onFile: () => void;
};

function AttachSheetRow({ row, className }: { row: Row; className?: string }) {
  return (
    <button type="button" className={className} onClick={row.onClick}>
      <span className="attach-sheet-row-icon" aria-hidden>
        {row.icon}
      </span>
      <span className="attach-sheet-row-text">
        <span className="attach-sheet-row-label">{row.label}</span>
        {row.hint ? <span className="attach-sheet-row-hint">{row.hint}</span> : null}
      </span>
    </button>
  );
}

export function AttachMediaSheet({
  open,
  onClose,
  onGallery,
  onCamera,
  onFile,
}: Props) {
  if (!open) return null;

  const rows: Row[] = [
    { label: 'Choose from gallery', icon: <AttachPhotoIcon />, onClick: onGallery },
    { label: 'Take shot', hint: 'Photo or video', icon: <AttachCameraIcon />, onClick: onCamera },
    { label: 'File', icon: <AttachFileIcon />, onClick: onFile },
  ];

  return (
    <div className="attach-sheet-backdrop fade-in" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="attach-sheet-group" role="dialog" aria-modal="true" aria-label="Attach">
          {rows.map((row, index) => (
            <AttachSheetRow
              key={row.label}
              row={row}
              className={`attach-sheet-row attach-sheet-row--icon${
                index === 0 ? ' attach-sheet-row-first' : ''
              }${index === rows.length - 1 ? ' attach-sheet-row-last' : ''}`}
            />
          ))}
        </div>
        <button type="button" className="attach-sheet-group attach-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
