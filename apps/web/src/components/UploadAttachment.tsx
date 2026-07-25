import { useUploadProgress } from '../hooks/useUploadProgress';
import { UploadProgressRing } from './UploadProgressRing';

function FileGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <path d="M14 3v5h5M6 3h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function UploadAttachment({
  fileName,
  fileSize,
  uploading,
  uploadProgress,
  ringSize = 40,
  onCancel,
}: {
  fileName: string;
  fileSize?: number;
  uploading: boolean;
  uploadProgress?: number;
  ringSize?: number;
  onCancel?: () => void;
}) {
  const { pct, subLabel, ringOffset } = useUploadProgress(uploading, fileSize, uploadProgress);
  const iconSize = ringSize <= 28 ? 12 : 16;

  return (
    <div className="upload-attachment" aria-live="polite" aria-busy={uploading}>
      <UploadProgressRing size={ringSize} ringOffset={ringOffset}>
        <FileGlyph size={iconSize} />
      </UploadProgressRing>
      <div className="upload-attachment-body">
        <div className="upload-attachment-name">{fileName}</div>
        <div className="upload-attachment-sub">{subLabel}</div>
      </div>
      <span className="upload-attachment-pct">{subLabel.includes('✓') ? '✓' : `${pct}%`}</span>
      {uploading && onCancel ? (
        <button
          type="button"
          className="upload-cancel-btn"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          aria-label="Cancel upload"
        >
          ×
        </button>
      ) : null}
      <span className="sr-only">{uploading ? `Uploading ${pct}%` : subLabel}</span>
    </div>
  );
}
