import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CollapseIcon, ExpandIcon } from './Icons';
import {
  ContactSharedContent,
  SHARED_FULLSCREEN_THRESHOLD,
  sharedTabCount,
} from './ContactSharedContent';
import type { SharedContentSummary, SharedContentTab } from '../lib/chat-shared-content';

export type { SharedContentTab };

type Props = {
  open: boolean;
  tab: SharedContentTab;
  contactId: string;
  contactAlias: string;
  shared: SharedContentSummary;
  onClose: () => void;
  onOpenMessage?: (messageId: string) => void;
};

const TAB_LABELS: Record<SharedContentTab, string> = {
  media: 'Media',
  files: 'Files',
  links: 'Links',
};

export function ContactSharedSheet({
  open,
  tab,
  contactId,
  contactAlias,
  shared,
  onClose,
  onOpenMessage: _onOpenMessage,
}: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open]);

  if (!open && !viewerOpen) return null;

  const handleViewerOpenChange = (next: boolean) => {
    setViewerOpen(next);
  };

  const sheetVisible = open && !viewerOpen && !fullscreen;
  const itemCount = sharedTabCount(tab, shared);
  const canFullscreen = itemCount > SHARED_FULLSCREEN_THRESHOLD;

  const headerActions = (
    <div className="contact-shared-sheet-actions">
      {canFullscreen && !fullscreen ? (
        <button
          type="button"
          className="contact-shared-expand-btn"
          onClick={() => setFullscreen(true)}
          aria-label="Open full screen"
        >
          <ExpandIcon />
        </button>
      ) : null}
      {fullscreen ? (
        <button
          type="button"
          className="contact-shared-expand-btn"
          onClick={() => setFullscreen(false)}
          aria-label="Exit full screen"
        >
          <CollapseIcon />
        </button>
      ) : null}
      <button
        type="button"
        className="create-group-close-btn"
        onClick={() => {
          setFullscreen(false);
          onClose();
        }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );

  const content = (
    <ContactSharedContent
      tab={tab}
      shared={shared}
      contactId={contactId}
      contactAlias={contactAlias}
      onViewerOpenChange={handleViewerOpenChange}
    />
  );

  return createPortal(
    <>
      {fullscreen ? (
        <div className="contact-shared-fullscreen" role="dialog" aria-modal="true" aria-label={TAB_LABELS[tab]}>
          <div className="contact-shared-fullscreen-header">
            <h2>{TAB_LABELS[tab]}</h2>
            {headerActions}
          </div>
          <div className="contact-shared-fullscreen-body">{content}</div>
        </div>
      ) : (
        <div
          className={`share-contact-backdrop${sheetVisible ? '' : ' share-contact-backdrop--hidden'}`}
          onClick={onClose}
          role="presentation"
        >
          <div
            className={`share-contact-sheet contact-shared-sheet${sheetVisible ? '' : ' contact-shared-sheet--hidden'}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={TAB_LABELS[tab]}
            aria-hidden={!sheetVisible}
          >
            <div className="share-contact-handle" aria-hidden />
            <div className="notifications-sheet-header contact-shared-sheet-header">
              <h2>{TAB_LABELS[tab]}</h2>
              {headerActions}
            </div>
            <div className="contact-shared-sheet-body">{content}</div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
