import { MediaMessage } from './MediaMessage';
import { SharedMediaGridCell } from './SharedMediaGridCell';
import { formatFileSize } from '../lib/file-mini-badge';
import { formatTime } from '../lib/types';
import { openExternalUrl } from '../lib/link-url';
import type { SharedContentSummary, SharedContentTab } from '../lib/chat-shared-content';

export type { SharedContentTab };

export const SHARED_FULLSCREEN_THRESHOLD = 9;

type Props = {
  tab: SharedContentTab;
  shared: SharedContentSummary;
  contactId: string;
  contactAlias: string;
  onViewerOpenChange?: (open: boolean) => void;
};

export function ContactSharedContent({ tab, shared, contactId, contactAlias, onViewerOpenChange }: Props) {
  if (tab === 'media') {
    if (shared.media.length === 0) {
      return <p className="contact-shared-empty">No photos or videos yet</p>;
    }
    return (
      <div className="contact-shared-media-grid">
        {shared.media.map((message) => (
          <div key={message.id} className="contact-shared-media-cell">
            <SharedMediaGridCell
              message={message}
              contactId={contactId}
              contactAlias={contactAlias}
              onViewerOpenChange={onViewerOpenChange}
            />
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'files') {
    if (shared.files.length === 0) {
      return <p className="contact-shared-empty">No files yet</p>;
    }
    return (
      <div className="contact-shared-file-list">
        {shared.files.map((message) => {
          const content = message.content;
          return (
            <div key={message.id} className="contact-shared-file-row">
              <MediaMessage
                messageId={message.id}
                contactId={contactId}
                kind="file"
                previewUrl={content.previewUrl}
                fileName={content.fileName}
                mime={content.mime}
                fileSize={content.size}
                title={contactAlias}
                subtitle={formatTime(message.timestamp)}
                onViewerOpenChange={onViewerOpenChange}
              />
              <span className="contact-shared-file-meta">
                {formatFileSize(content.size)} · {formatTime(message.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (shared.links.length === 0) {
    return <p className="contact-shared-empty">No links yet</p>;
  }

  return (
    <div className="contact-shared-link-list">
      {shared.links.map((link) => (
        <button
          key={`${link.messageId}-${link.url}`}
          type="button"
          className="contact-shared-link-row"
          onClick={() => {
            openExternalUrl(link.url);
          }}
        >
          <span className="contact-shared-link-url">{link.url}</span>
          {link.preview && link.preview !== link.url ? (
            <span className="contact-shared-link-preview">{link.preview}</span>
          ) : null}
          <span className="contact-shared-link-time">{formatTime(link.timestamp)}</span>
        </button>
      ))}
    </div>
  );
}

export function sharedTabCount(tab: SharedContentTab, shared: SharedContentSummary): number {
  if (tab === 'media') return shared.media.length;
  if (tab === 'files') return shared.files.length;
  return shared.links.length;
}
