export type FileVisualKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | '3d'
  | 'document-pdf'
  | 'document-docx'
  | 'document-pptx'
  | 'document-xlsx'
  | 'document-odt'
  | 'document-ods'
  | 'document-odp'
  | 'design-psd'
  | 'design-ai'
  | 'design-xd'
  | 'design-sketch'
  | 'design-fig'
  | 'other-epub'
  | 'other-apk'
  | 'other-ipa'
  | 'other-ics'
  | 'other-generic';

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'avif', 'svg',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp', 'flv',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus',
]);

const ARCHIVE_EXTENSIONS = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
]);

const CODE_EXTENSIONS = new Set([
  'txt', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
  'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'php', 'sql', 'md', 'log', 'sh',
]);

const THREE_D_EXTENSIONS = new Set([
  'glb', 'gltf', 'obj', 'fbx', 'stl', 'blend',
]);

const EXT_TO_VISUAL: Record<string, FileVisualKind> = {
  pdf: 'document-pdf',
  doc: 'document-docx',
  docx: 'document-docx',
  pages: 'document-docx',
  rtf: 'document-docx',
  ppt: 'document-pptx',
  pptx: 'document-pptx',
  key: 'document-pptx',
  xls: 'document-xlsx',
  xlsx: 'document-xlsx',
  csv: 'document-xlsx',
  numbers: 'document-xlsx',
  odt: 'document-odt',
  ods: 'document-ods',
  odp: 'document-odp',
  psd: 'design-psd',
  ai: 'design-ai',
  xd: 'design-xd',
  sketch: 'design-sketch',
  fig: 'design-fig',
  epub: 'other-epub',
  apk: 'other-apk',
  ipa: 'other-ipa',
  ics: 'other-ics',
};

/** All supported file extensions (lowercase, unique). */
export const SUPPORTED_FILE_EXTENSIONS: readonly string[] = Array.from(
  new Set([
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...ARCHIVE_EXTENSIONS,
    ...CODE_EXTENSIONS,
    ...THREE_D_EXTENSIONS,
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
    'odt', 'ods', 'odp', 'rtf', 'csv', 'pages', 'numbers', 'key',
    'psd', 'ai', 'xd', 'sketch', 'fig',
    'epub', 'apk', 'ipa', 'ics',
  ]),
).sort();

export function normalizeExtension(ext: string): string {
  return ext.trim().replace(/^\./, '').toLowerCase();
}

export function formatLabel(ext: string): string {
  const e = normalizeExtension(ext);
  if (!e) return 'FILE';
  if (e === 'jpeg') return 'JPG';
  if (e === 'mpeg') return 'MP3';
  return e.toUpperCase();
}

export function resolveFileVisual(ext: string): FileVisualKind {
  const e = normalizeExtension(ext);
  if (!e) return 'other-generic';

  if (IMAGE_EXTENSIONS.has(e)) return 'image';
  if (VIDEO_EXTENSIONS.has(e)) return 'video';
  if (AUDIO_EXTENSIONS.has(e)) return 'audio';
  if (ARCHIVE_EXTENSIONS.has(e)) return 'archive';
  if (CODE_EXTENSIONS.has(e)) return 'code';
  if (THREE_D_EXTENSIONS.has(e)) return '3d';

  return EXT_TO_VISUAL[e] ?? 'other-generic';
}
