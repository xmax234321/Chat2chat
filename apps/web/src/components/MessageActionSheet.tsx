import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CopyIcon, DownloadIcon, ForwardIcon, SelectMoreIcon } from './Icons';

type Row = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type Props = {
  open: boolean;
  canCopy: boolean;
  canForward: boolean;
  canDownload: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  onSelectMore: () => void;
};

function ActionSheetRow({ row, className }: { row: Row; className?: string }) {
  return (
    <button type="button" className={className} onClick={row.onClick} disabled={row.disabled}>
      <span className="attach-sheet-row-icon" aria-hidden>
        {row.icon}
      </span>
      <span className="attach-sheet-row-text">
        <span className="attach-sheet-row-label">{row.label}</span>
      </span>
    </button>
  );
}

export function MessageActionSheet({
  open,
  canCopy,
  canForward,
  canDownload,
  canDelete = false,
  onClose,
  onCopy,
  onForward,
  onDownload,
  onDelete,
  onSelectMore,
}: Props) {
  if (!open) return null;

  const rows: Row[] = [
    { label: 'Copy', icon: <CopyIcon />, onClick: onCopy, disabled: !canCopy },
    { label: 'Forward', icon: <ForwardIcon />, onClick: onForward, disabled: !canForward },
    {
      label: 'Download',
      icon: <DownloadIcon />,
      onClick: onDownload,
      disabled: !canDownload,
    },
    ...(canDelete && onDelete
      ? [{ label: 'Delete', icon: <span aria-hidden>🗑</span>, onClick: onDelete }]
      : []),
    { label: 'Select more', icon: <SelectMoreIcon />, onClick: onSelectMore },
  ];

  return createPortal(
    <div className="attach-sheet-backdrop fade-in" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="attach-sheet-group" role="dialog" aria-modal="true" aria-label="Message actions">
          {rows.map((row, index) => (
            <ActionSheetRow
              key={row.label}
              row={row}
              className={`attach-sheet-row attach-sheet-row--icon${
                index === 0 ? ' attach-sheet-row-first' : ''
              }${index === rows.length - 1 ? ' attach-sheet-row-last' : ''}${
                row.disabled ? ' attach-sheet-row-disabled' : ''
              }`}
            />
          ))}
        </div>
        <button type="button" className="attach-sheet-group attach-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
