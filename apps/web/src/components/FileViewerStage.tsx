import { useEffect, useMemo, useState } from 'react';
import { MediaViewerVideo } from './MediaViewerVideo';
import { renderFileTypePreview } from '../lib/file-type-preview';
import { resolveFileViewerMode, type FileViewerMode } from '../lib/file-viewer-mode';
import { formatLabel, normalizeExtension } from '../lib/file-type-registry';
import { parseOfficeDocument } from '../lib/office-document-text';

const MAX_TEXT_CHARS = 120_000;
const MAX_PDF_PAGES = 100;

function fileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return normalizeExtension(parts.pop() ?? '');
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function PdfPages({ data }: { data: Uint8Array }) {
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href;
        const doc = await pdfjs.getDocument({
          data: data.slice(),
          useWorkerFetch: false,
          isEvalSupported: false,
        }).promise;
        const count = Math.min(doc.numPages, MAX_PDF_PAGES);
        const urls: string[] = [];
        for (let i = 1; i <= count; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          urls.push(canvas.toDataURL('image/jpeg', 0.92));
        }
        if (!cancelled) setPages(urls);
      } catch {
        if (!cancelled) setError('Could not render PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) return <div className="file-viewer-status">{error}</div>;
  if (!pages.length) return <div className="file-viewer-status">Loading PDF…</div>;

  return (
    <div className="file-viewer-pdf-scroll">
      {pages.map((src, i) => (
        <img key={i} src={src} alt={`Page ${i + 1}`} className="file-viewer-pdf-page" />
      ))}
    </div>
  );
}

function TextContent({ data, ext }: { data: Uint8Array; ext: string }) {
  const { text, truncated } = useMemo(() => {
    const raw = decodeText(data);
    if (raw.length <= MAX_TEXT_CHARS) return { text: raw, truncated: false };
    return { text: raw.slice(0, MAX_TEXT_CHARS), truncated: true };
  }, [data]);

  const lang = ['json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'go', 'rs', 'sql', 'md', 'yaml', 'yml'].includes(ext)
    ? ext
    : undefined;

  return (
    <div className="file-viewer-text-wrap">
      <pre className="file-viewer-text">
        <code className={lang ? `language-${lang}` : undefined}>{text}</code>
      </pre>
      {truncated && <div className="file-viewer-text-note">Showing first {MAX_TEXT_CHARS.toLocaleString()} characters</div>}
    </div>
  );
}

function OfficeDocumentContent({ data, ext }: { data: Uint8Array; ext: string }) {
  const view = useMemo(() => parseOfficeDocument(data, ext), [data, ext]);

  if (view.kind === 'error') {
    return <div className="file-viewer-status">{view.message}</div>;
  }

  if (view.kind === 'slides') {
    return (
      <div className="file-viewer-document">
        <div className="file-viewer-document-head">{view.title}</div>
        {view.slides.map((slide) => (
          <section key={slide.title} className="file-viewer-document-slide">
            <div className="file-viewer-document-slide-title">{slide.title}</div>
            <div className="file-viewer-document-body">{slide.body}</div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="file-viewer-document">
      <div className="file-viewer-document-head">{view.title}</div>
      <div className="file-viewer-document-body">{view.body}</div>
    </div>
  );
}

function PreviewFallback({
  fileName,
  mime,
  size,
  ext,
}: {
  fileName: string;
  mime?: string;
  size: number;
  ext: string;
}) {
  const artUrl = useMemo(() => renderFileTypePreview(ext || 'file'), [ext]);

  return (
    <div className="file-viewer-preview">
      <img src={artUrl} alt="" className="file-viewer-preview-art" />
      <div className="file-viewer-preview-name">{fileName}</div>
      <div className="file-viewer-preview-meta">
        {formatLabel(ext)} · {formatBytes(size)}
        {mime ? ` · ${mime}` : ''}
      </div>
      <p className="file-viewer-preview-hint">Use Share or Save to open in another app</p>
    </div>
  );
}

export function FileViewerStage({
  blobUrl,
  data,
  fileName,
  mime,
  mode,
  videoChrome,
  onToggleVideoChrome,
}: {
  blobUrl: string;
  data: Uint8Array;
  fileName: string;
  mime?: string;
  mode: FileViewerMode;
  videoChrome: boolean;
  onToggleVideoChrome: () => void;
}) {
  const ext = fileExtension(fileName);

  switch (mode) {
    case 'image':
    case 'svg':
      return <img src={blobUrl} alt={fileName} className="media-viewer-image" draggable={false} />;
    case 'video':
      return (
        <MediaViewerVideo
          src={blobUrl}
          chrome={videoChrome}
          onToggleChrome={onToggleVideoChrome}
        />
      );
    case 'audio': {
      const artUrl = renderFileTypePreview(ext || 'mp3');
      return (
        <div className="file-viewer-audio">
          <img src={artUrl} alt="" className="file-viewer-audio-art" />
          <audio controls playsInline preload="metadata" src={blobUrl} className="file-viewer-audio-el">
            <track kind="captions" />
          </audio>
        </div>
      );
    }
    case 'pdf':
      return <PdfPages data={data} />;
    case 'text':
      return <TextContent data={data} ext={ext} />;
    case 'document':
      return <OfficeDocumentContent data={data} ext={ext} />;
    default:
      return (
        <PreviewFallback
          fileName={fileName}
          mime={mime}
          size={data.length}
          ext={ext}
        />
      );
  }
}

export function fileViewerModeFor(mime: string | undefined, fileName: string): FileViewerMode {
  return resolveFileViewerMode(mime ?? '', fileName);
}
