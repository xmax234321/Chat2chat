import { isAllowedMediaMime } from '@chat2chat/crypto/browser';

export const MEDIA_FILE_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/x-matroska,.heic,.heif,.mov,.mkv,.webp,.gif,.png,.jpg,.jpeg,.mp4,.webm,.m4v';

export const VIDEO_FILE_ACCEPT =
  'video/mp4,video/webm,video/quicktime,video/x-matroska,.mov,.mkv,.mp4,.webm,.m4v';

export const DOCUMENT_FILE_ACCEPT =
  '.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pages,.numbers,.key,.rtf,.csv,.md,' +
  '.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.rar,.7z,.tar,.gz,.json,.xml,.yaml,.yml,.html,.css,.js,.ts,.py,.java,.cpp,.c,.cs,.go,.rs,.php,.sql,.log,' +
  '.psd,.ai,.sketch,.fig,.xd,.stl,.obj,.gltf,.glb,.fbx,.blend,.odt,.ods,.odp,.epub,.apk,.ipa,.ics,' +
  'application/pdf,application/zip,application/x-zip-compressed,text/plain,application/octet-stream,' +
  'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/flac,audio/ogg,audio/opus';

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  csv: 'text/csv',
  md: 'text/markdown',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  ts: 'text/typescript',
  py: 'text/x-python',
  java: 'text/x-java',
  cpp: 'text/x-c++',
  c: 'text/x-c',
  cs: 'text/x-csharp',
  php: 'text/x-php',
  sql: 'application/sql',
  log: 'text/plain',
  rs: 'text/x-rust',
  go: 'text/x-go',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  '3gp': 'video/3gpp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  blend: 'application/x-blender',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  epub: 'application/epub+zip',
  apk: 'application/vnd.android.package-archive',
  ipa: 'application/octet-stream',
  ics: 'text/calendar',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
};

function mimeFromName(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_MIME[ext] ?? null;
}

function mimeFromBytes(data: Uint8Array): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return 'image/png';
  }
  if (data.length >= 4 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return 'image/gif';
  }
  if (data.length >= 12) {
    const box = String.fromCharCode(...data.subarray(4, 8));
    const brand = String.fromCharCode(...data.subarray(8, 12)).toLowerCase();
    if (box === 'ftyp') {
      if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1' || brand === 'heix') {
        return 'image/heic';
      }
      if (brand.includes('qt') || brand === 'moov') return 'video/quicktime';
      return 'video/mp4';
    }
    const riff = String.fromCharCode(...data.subarray(0, 4));
    if (riff === 'RIFF') {
      const webp = String.fromCharCode(...data.subarray(8, 12));
      if (webp === 'WEBP') return 'image/webp';
    }
  }
  return null;
}

/** Resolve MIME for gallery picks (iOS often leaves file.type empty). */
export function resolveMediaMime(file: File, data?: Uint8Array): string {
  const type = file.type?.trim().toLowerCase();
  if (type && isAllowedMediaMime(type)) return type;
  const fromName = mimeFromName(file.name);
  if (fromName && isAllowedMediaMime(fromName)) return fromName;
  if (data) {
    const fromBytes = mimeFromBytes(data);
    if (fromBytes && isAllowedMediaMime(fromBytes)) return fromBytes;
  }
  return type || fromName || 'application/octet-stream';
}

export function isMediaFile(file: File, data?: Uint8Array): boolean {
  return isAllowedMediaMime(resolveMediaMime(file, data));
}

const ATTACHABLE_EXTENSIONS = new Set([
  'pdf', 'zip', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pages', 'numbers', 'key', 'rtf', 'csv', 'md',
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus',
  'rar', '7z', 'tar', 'gz', 'bz2',
  'json', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'cs', 'h', 'sh', 'php', 'sql', 'log',
  'psd', 'ai', 'sketch', 'fig', 'xd',
  'stl', 'obj', 'gltf', 'glb', 'fbx', 'blend',
  'odt', 'ods', 'odp', 'epub', 'apk', 'ipa', 'ics',
  'avi', 'flv', '3gp', 'avif', 'svg',
]);

export function isAttachableFile(file: File, data?: Uint8Array): boolean {
  const mime = resolveMediaMime(file, data);
  if (isAllowedMediaMime(mime)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ATTACHABLE_EXTENSIONS.has(ext)) return true;
  if (mime === 'application/octet-stream' && file.name.trim()) return true;
  return false;
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-matroska': 'mkv',
  };
  return map[mime] ?? 'bin';
}

export function defaultFileName(mime: string): string {
  const ext = extFromMime(mime);
  if (mime.startsWith('video/')) return `video.${ext}`;
  return `photo.${ext}`;
}
