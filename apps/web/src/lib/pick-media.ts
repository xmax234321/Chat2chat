import { resolveMediaMime, isMediaFile, isAttachableFile } from '../lib/media-file';
import { readBytesFromUserFile } from '../lib/read-user-file';
import { createFullImageBlobUrl, visualMediaKind } from './media-thumbnail';

import type { EphemeralMedia } from './ephemeral-media';

export type SendQuality = 'full' | 'compressed';

export interface PickedMedia {
  file: File;
  mime: string;
  /** Raw bytes when already read (videos, desktop). */
  data?: Uint8Array;
  /** Native filesystem path — kept for preview / fallback reads on iOS. */
  nativePath?: string;
  /** Byte size from native picker when known (skips extra stat round-trip). */
  nativeSize?: number;
  /** Local display URL — used on iOS before re-encode. */
  previewUrl?: string;
  /** Generic document (not photo/video). */
  isFile?: boolean;
  /** Recorded voice message. */
  isVoice?: boolean;
  /** Voice message duration in milliseconds. */
  durationMs?: number;
  /** Disappearing photo/video settings. */
  ephemeral?: EphemeralMedia | null;
  /** Album grouping when sending multiple photos/videos together. */
  mediaGroupId?: string;
  mediaGroupIndex?: number;
  mediaGroupTotal?: number;
  /** Full original bytes vs compressed before send. */
  sendQuality?: SendQuality;
  /** Optional caption shown under the media bubble. */
  caption?: string;
}

export function normalizeVideoMime(mime: string, fileName: string): string {
  const m = mime.trim().toLowerCase();
  if (m === 'video/quicktime' || m === 'video/mp4' || m === 'video/webm' || m === 'video/x-matroska') {
    return m;
  }
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mkv') return 'video/x-matroska';
  return 'video/mp4';
}

export async function pickAndValidateMediaFile(file: File): Promise<PickedMedia> {
  const data = await readBytesFromUserFile(file);
  const mime = resolveMediaMime(file, data);
  if (!isMediaFile(file, data)) {
    throw new Error('Only photos and videos are supported');
  }
  const normalized = mime.startsWith('video/') ? normalizeVideoMime(mime, file.name) : mime;
  const previewUrl = URL.createObjectURL(new Blob([data.slice()], { type: normalized }));
  return { file, data, mime: normalized, previewUrl };
}

export async function pickAndValidateFile(file: File): Promise<PickedMedia> {
  const data = await readBytesFromUserFile(file);
  const mime = resolveMediaMime(file, data);
  if (!isAttachableFile(file, data)) {
    throw new Error('Unsupported file type');
  }
  const previewUrl =
    visualMediaKind(mime, file.name) === 'image'
      ? createFullImageBlobUrl(data, mime)
      : undefined;
  return { file, data, mime, previewUrl, isFile: true };
}
