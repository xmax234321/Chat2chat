import { base64UrlEncode, base64UrlDecode } from './base64.js';

export const ATTACHMENT_META_BUCKET = 2048;

export type ContentKind = 'text' | 'image' | 'video' | 'file' | 'voice';

export interface TextContent {
  kind: 'text';
  body: string;
}

export interface AttachmentContent {
  kind: 'image' | 'video' | 'file' | 'voice';
  blobId: string;
  mime: string;
  fileName: string;
  size: number;
  /** base64url-encoded 32-byte AES file key */
  fileKey: string;
  /** SHA-256 hex digest of original file */
  digest: string;
  /** Voice message duration in milliseconds */
  durationMs?: number;
}

export type MessageContent = TextContent | AttachmentContent;

export function encodeContent(content: MessageContent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(content));
}

export function decodeContent(bytes: Uint8Array): MessageContent {
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as MessageContent;
  if (!parsed.kind) throw new Error('Invalid message content');
  return parsed;
}

export function encodeFileKey(key: Uint8Array): string {
  return base64UrlEncode(key);
}

export function decodeFileKey(encoded: string): Uint8Array {
  return base64UrlDecode(encoded);
}

export function isAttachment(content: MessageContent): content is AttachmentContent {
  return content.kind === 'image' || content.kind === 'video' || content.kind === 'file' || content.kind === 'voice';
}
