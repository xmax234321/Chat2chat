import { classifyAttachment } from './media-thumbnail';
import { normalizeExtension, resolveFileVisual } from './file-type-registry';

export type FileViewerMode =
  | 'image'
  | 'svg'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'archive'
  | 'document'
  | 'preview';

const OFFICE_EXTENSIONS = new Set([
  'docx', 'pptx', 'xlsx', 'odt', 'ods', 'odp', 'pages', 'numbers', 'key', 'csv',
]);

const TEXT_VIEW_EXTENSIONS = new Set([
  'txt', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
  'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'php', 'sql', 'md', 'log', 'sh', 'ics',
]);

function fileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return (parts.pop() ?? '').toLowerCase();
}

export function resolveFileViewerMode(mime: string, fileName: string): FileViewerMode {
  const ext = normalizeExtension(fileExtension(fileName));
  const category = classifyAttachment(mime, fileName);

  if (category === 'image') return ext === 'svg' ? 'svg' : 'image';
  if (category === 'video') return 'video';
  if (category === 'audio') return 'audio';
  if (category === 'pdf') return 'pdf';
  if (category === 'code' || TEXT_VIEW_EXTENSIONS.has(ext)) return 'text';
  if (OFFICE_EXTENSIONS.has(ext)) return 'document';
  if (category === 'document') return 'preview';

  void resolveFileVisual(ext);
  return 'preview';
}
