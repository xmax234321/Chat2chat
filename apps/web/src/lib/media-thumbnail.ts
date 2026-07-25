export type MediaCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'archive'
  | 'code'
  | 'design'
  | '3d'
  | 'other';

import { renderFileTypePreview } from './file-type-preview';

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/svg+xml',
]);

const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/avi',
  'video/x-msvideo',
  'video/3gpp',
  'video/x-m4v',
  'video/x-flv',
]);

const AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
]);

const EXT_CATEGORY: Record<string, MediaCategory> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  heic: 'image',
  heif: 'image',
  avif: 'image',
  svg: 'image',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  webm: 'video',
  m4v: 'video',
  '3gp': 'video',
  flv: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  flac: 'audio',
  ogg: 'audio',
  opus: 'audio',
  pdf: 'pdf',
  doc: 'document',
  docx: 'document',
  xls: 'document',
  xlsx: 'document',
  ppt: 'document',
  pptx: 'document',
  odt: 'document',
  ods: 'document',
  odp: 'document',
  txt: 'code',
  rtf: 'document',
  pages: 'document',
  numbers: 'document',
  key: 'document',
  csv: 'document',
  md: 'code',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  bz2: 'archive',
  js: 'code',
  ts: 'code',
  jsx: 'code',
  tsx: 'code',
  py: 'code',
  rs: 'code',
  go: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  cs: 'code',
  h: 'code',
  json: 'code',
  xml: 'code',
  yaml: 'code',
  yml: 'code',
  html: 'code',
  css: 'code',
  php: 'code',
  sql: 'code',
  log: 'code',
  sh: 'code',
  psd: 'design',
  ai: 'design',
  sketch: 'design',
  fig: 'design',
  xd: 'design',
  stl: '3d',
  obj: '3d',
  gltf: '3d',
  glb: '3d',
  fbx: '3d',
  blend: '3d',
  epub: 'other',
  apk: 'other',
  ics: 'other',
};

function fileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return (parts.pop() ?? '').toLowerCase();
}

function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase().split(';')[0] ?? '';
}

export function classifyAttachment(mime: string, fileName: string): MediaCategory {
  const m = normalizeMime(mime);
  if (IMAGE_MIMES.has(m) || m.startsWith('image/')) return 'image';
  if (VIDEO_MIMES.has(m) || m.startsWith('video/')) return 'video';
  if (AUDIO_MIMES.has(m) || m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf') return 'pdf';

  const ext = fileExtension(fileName);
  if (ext && EXT_CATEGORY[ext]) return EXT_CATEGORY[ext];

  if (m.includes('zip') || m.includes('compressed') || m.includes('archive')) return 'archive';
  if (m.includes('text') || m.includes('document') || m.includes('word') || m.includes('sheet')) {
    return 'document';
  }

  return 'other';
}

function canvasToBlobUrl(canvas: HTMLCanvasElement): string {
  return URL.createObjectURL(
  dataUrlToBlob(canvas.toDataURL('image/jpeg', 0.88)),
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function fileTypePreview(ext: string, duration?: string): string {
  return renderFileTypePreview(ext || 'file', duration ? { duration } : undefined);
}

function scaleToMax(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const ratio = Math.min(max / w, max / h);
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

/** Full-resolution blob URL for chat bubble images (no downscale). */
export function createFullImageBlobUrl(data: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([data.slice()], { type: mime || 'image/jpeg' }));
}

const VIDEO_THUMB_MAX = 720;

async function imagePreviewUrl(data: Uint8Array, mime: string): Promise<string | undefined> {
  const blob = new Blob([data.slice()], { type: mime });
  const url = URL.createObjectURL(blob);

  if (mime === 'image/svg+xml') {
    return url;
  }

  try {
    const img = await loadImage(url);
    const { w, h } = scaleToMax(img.naturalWidth || img.width, img.naturalHeight || img.height, 320);
    if (w === img.naturalWidth && h === img.naturalHeight) return url;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return canvasToBlobUrl(canvas);
  } catch {
    return url;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function parseVideoDuration(data: Uint8Array, mime: string): Promise<string | undefined> {
  const blob = new Blob([data.slice()], { type: mime });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const secs = Math.round(video.duration);
      if (!Number.isFinite(secs) || secs <= 0) {
        resolve(undefined);
        return;
      }
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      resolve(`${m}:${String(s).padStart(2, '0')}`);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    video.src = url;
  });
}

async function videoPreviewUrl(
  data: Uint8Array,
  mime: string,
  ext: string,
): Promise<string | undefined> {
  const blob = new Blob([data.slice()], { type: mime });
  const url = URL.createObjectURL(blob);

  let duration: string | undefined;
  try {
    duration = await parseVideoDuration(data, mime);
  } catch {
    /* ignore */
  }

  try {
    const frame = await extractVideoFrame(url);
    URL.revokeObjectURL(url);
    return frame;
  } catch {
    URL.revokeObjectURL(url);
    return fileTypePreview(ext || 'mp4', duration);
  }
}

function extractVideoFrame(videoUrl: string, maxSize = VIDEO_THUMB_MAX): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      finish(() => reject(new Error('video thumb timeout')));
    }, 45_000);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const seekTo = Number.isFinite(duration) && duration > 0
        ? Math.min(1.5, Math.max(0.05, duration * 0.08))
        : 0.1;
      video.currentTime = seekTo;
    };

    video.onseeked = () => {
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const size = maxSize;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          finish(() => reject(new Error('no canvas')));
          return;
        }
        const srcAspect = vw / vh;
        let sx = 0;
        let sy = 0;
        let sw = vw;
        let sh = vh;
        if (srcAspect > 1) {
          sw = vh;
          sx = (vw - vh) / 2;
        } else if (srcAspect < 1) {
          sh = vw;
          sy = (vh - vw) / 2;
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
        const result = canvasToBlobUrl(canvas);
        cleanup();
        finish(() => resolve(result));
      } catch (e) {
        cleanup();
        finish(() => reject(e instanceof Error ? e : new Error('thumb failed')));
      }
    };

    video.onerror = () => {
      cleanup();
      finish(() => reject(new Error('video load failed')));
    };

    video.src = videoUrl;
  });
}

/** True when preview is a generated frame, not a generic file-type placeholder. */
export function isVideoFramePreview(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/png')) return false;
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/webp')) return true;
  if (url.startsWith('blob:')) return true;
  if (url.startsWith('capacitor://')) return true;
  if (url.includes('_capacitor_file_')) return true;
  return false;
}

/** Extract a bubble thumbnail from any playable video URL (native path, blob, etc.). */
export async function createVideoBubbleThumbFromUrl(
  videoUrl: string,
  fileName = 'video.mp4',
  fsPath?: string,
): Promise<string> {
  const { isCapacitor } = await import('./platform');
  if (isCapacitor()) {
    const { createNativeVideoThumbUrl } = await import('./native-video-thumb');
    const path = fsPath ?? videoUrl.replace(/^file:\/\//, '');
    if (path && !path.startsWith('blob:') && !path.startsWith('data:')) {
      const nativeThumb = await createNativeVideoThumbUrl(path);
      if (nativeThumb) return nativeThumb;
    }
  }

  try {
    const frame = await extractVideoFrame(videoUrl);
    if (frame) return frame;
  } catch {
    /* fall through */
  }
  return createInstantVideoThumbUrl(fileName);
}

/** Static video icon for chat bubbles — no decode, instant after restart. */
export function createInstantVideoThumbUrl(fileName: string): string {
  return fileTypePreview(fileExtension(fileName) || 'mp4');
}

/** Video frame thumbnail for chat bubbles. */
export async function createVideoBubbleThumbUrl(
  data: Uint8Array,
  mime: string,
  fileName: string,
): Promise<string | undefined> {
  return videoPreviewUrl(data, mime, fileExtension(fileName));
}

function parseAudioDuration(data: Uint8Array, mime: string): Promise<string | undefined> {
  const blob = new Blob([data.slice()], { type: mime });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const secs = Math.round(audio.duration);
      if (!Number.isFinite(secs) || secs <= 0) {
        resolve(undefined);
        return;
      }
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      resolve(`${m}:${String(s).padStart(2, '0')}`);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    audio.src = url;
  });
}

async function audioPreviewUrl(
  data: Uint8Array,
  mime: string,
  ext: string,
): Promise<string | undefined> {
  let duration: string | undefined;
  try {
    duration = await parseAudioDuration(data, mime);
  } catch {
    /* ignore */
  }
  return fileTypePreview(ext || 'mp3', duration);
}

export function visualMediaKind(mime: string, fileName: string): 'image' | 'video' | null {
  const category = classifyAttachment(mime, fileName);
  return category === 'image' || category === 'video' ? category : null;
}

export async function createMediaPreviewUrl(
  data: Uint8Array,
  mime: string,
  fileName: string,
): Promise<string | undefined> {
  if (!data.length || typeof document === 'undefined') return undefined;

  const category = classifyAttachment(mime, fileName);
  const ext = fileExtension(fileName);
  const normalizedMime = normalizeMime(mime);

  switch (category) {
    case 'image':
      return imagePreviewUrl(data, normalizedMime || `image/${ext || 'jpeg'}`);
    case 'video':
      return videoPreviewUrl(data, normalizedMime || `video/${ext || 'mp4'}`, ext);
    case 'audio':
      return audioPreviewUrl(data, normalizedMime || `audio/${ext || 'mpeg'}`, ext);
    case 'pdf':
      return fileTypePreview(ext || 'pdf');
    default:
      return fileTypePreview(ext || 'file');
  }
}
