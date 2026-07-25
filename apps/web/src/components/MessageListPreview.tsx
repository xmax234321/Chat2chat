import type { MessageListPreview as Preview } from '../lib/message-preview';

function PhotoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="m21 16-5.5-5.5L5 20" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function PreviewKindIcon({ kind }: { kind: Preview['kind'] }) {
  switch (kind) {
    case 'image':
      return <PhotoIcon />;
    case 'video':
      return <VideoIcon />;
    case 'voice':
      return <VoiceIcon />;
    case 'file':
    case 'invite':
    case 'notice':
      return <FileIcon />;
    default:
      return null;
  }
}

export function MessageListPreviewLine({ preview }: { preview: Preview }) {
  const showIcon = preview.kind !== 'text' && preview.kind !== 'empty';

  return (
    <span className={`message-list-preview${preview.pending ? ' message-list-preview--pending' : ''}`}>
      {showIcon ? (
        <span className="message-list-preview-icon">
          <PreviewKindIcon kind={preview.kind} />
        </span>
      ) : null}
      <span className="message-list-preview-text">{preview.text}</span>
    </span>
  );
}
