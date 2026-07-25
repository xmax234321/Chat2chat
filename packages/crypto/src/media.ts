import { gcm } from '@noble/ciphers/aes';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;
const CHUNK_SIZE = 64 * 1024;

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
]);

export const ALLOWED_FILE_MIMES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'application/octet-stream',
]);

export const ALLOWED_VOICE_MIMES = new Set([
  'audio/mp4',
  'audio/aac',
  'audio/webm',
  'audio/mpeg',
  'audio/x-m4a',
]);

export type MediaKind = 'image' | 'video' | 'file' | 'voice';

export interface EncryptedMedia {
  encrypted: Uint8Array;
  fileKey: Uint8Array;
  digest: string;
  originalSize: number;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function mediaKindFromMime(mime: string): MediaKind {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? mime;
  if (ALLOWED_IMAGE_MIMES.has(base)) return 'image';
  if (ALLOWED_VIDEO_MIMES.has(base)) return 'video';
  if (ALLOWED_VOICE_MIMES.has(base)) return 'voice';
  if (ALLOWED_FILE_MIMES.has(base)) return 'file';
  throw new Error(`Unsupported media type: ${mime}`);
}

export function isAllowedMediaMime(mime: string): boolean {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? mime;
  return (
    ALLOWED_IMAGE_MIMES.has(base) ||
    ALLOWED_VIDEO_MIMES.has(base) ||
    ALLOWED_VOICE_MIMES.has(base) ||
    ALLOWED_FILE_MIMES.has(base)
  );
}

function encryptChunk(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE_LENGTH);
  const encrypted = gcm(key, nonce).encrypt(plaintext);
  const out = new Uint8Array(NONCE_LENGTH + encrypted.length);
  out.set(nonce, 0);
  out.set(encrypted, NONCE_LENGTH);
  return out;
}

function decryptChunk(key: Uint8Array, data: Uint8Array): Uint8Array {
  const nonce = data.subarray(0, NONCE_LENGTH);
  const encrypted = data.subarray(NONCE_LENGTH);
  return gcm(key, nonce).decrypt(encrypted);
}

function wrapChunk(encrypted: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + encrypted.length);
  out[0] = (encrypted.length >> 24) & 0xff;
  out[1] = (encrypted.length >> 16) & 0xff;
  out[2] = (encrypted.length >> 8) & 0xff;
  out[3] = encrypted.length & 0xff;
  out.set(encrypted, 4);
  return out;
}

function unwrapNextChunk(data: Uint8Array, offset: number): { chunk: Uint8Array; next: number } {
  const len = (data[offset]! << 24) | (data[offset + 1]! << 16) | (data[offset + 2]! << 8) | data[offset + 3]!;
  const start = offset + 4;
  return { chunk: data.subarray(start, start + len), next: start + len };
}

export function encryptMedia(plaintext: Uint8Array): EncryptedMedia {
  const fileKey = randomBytes(KEY_LENGTH);
  const digest = bytesToHex(sha256(plaintext));

  if (plaintext.length <= CHUNK_SIZE) {
    return { encrypted: encryptChunk(fileKey, plaintext), fileKey, digest, originalSize: plaintext.length };
  }

  const wrapped: Uint8Array[] = [];
  for (let offset = 0; offset < plaintext.length; offset += CHUNK_SIZE) {
    wrapped.push(wrapChunk(encryptChunk(fileKey, plaintext.subarray(offset, offset + CHUNK_SIZE))));
  }
  const encrypted = new Uint8Array(wrapped.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const part of wrapped) {
    encrypted.set(part, pos);
    pos += part.length;
  }
  return { encrypted, fileKey, digest, originalSize: plaintext.length };
}

export function decryptMedia(encrypted: Uint8Array, fileKey: Uint8Array, originalSize: number): Uint8Array {
  if (originalSize <= CHUNK_SIZE) return decryptChunk(fileKey, encrypted);
  const parts: Uint8Array[] = [];
  let offset = 0;
  while (offset < encrypted.length) {
    const { chunk, next } = unwrapNextChunk(encrypted, offset);
    parts.push(decryptChunk(fileKey, chunk));
    offset = next;
  }
  const plain = new Uint8Array(originalSize);
  let pos = 0;
  for (const part of parts) {
    plain.set(part.subarray(0, plain.length - pos), pos);
    pos += part.length;
  }
  return plain;
}
