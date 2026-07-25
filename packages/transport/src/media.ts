import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  decryptMedia,
  encryptMedia,
  isAllowedMediaMime,
  mediaKindFromMime,
  padToBucket,
  unpadFromBucket,
} from '@chat2chat/crypto';
import {
  ATTACHMENT_META_BUCKET,
  decodeContent,
  decodeFileKey,
  encodeContent,
  encodeFileKey,
  type AttachmentContent,
  type MessageContent,
} from '@chat2chat/protocol';
import type { TransportClient } from './client.js';

export interface MediaClientOptions {
  transport: TransportClient;
  userId: string;
  /** HTTP base URL, e.g. http://localhost:3847 */
  httpBaseUrl: string;
}

export interface SendMediaParams {
  recipientId: string;
  messageId: string;
  blobId: string;
  data: Uint8Array;
  mime: string;
  fileName: string;
}

export interface ReceivedMedia {
  messageId: string;
  content: AttachmentContent;
  data: Uint8Array;
}

/** Derive HTTP base URL from WebSocket URL */
export function httpBaseFromWsUrl(wsUrl: string): string {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.origin;
}

/**
 * Photo/video transport via separate HTTP blob channel.
 * Metadata travels in WebSocket envelope; encrypted bytes via PUT /blob.
 */
export class MediaClient {
  private readonly pendingBlobAcks = new Set<string>();

  constructor(private readonly options: MediaClientOptions) {}

  /** Encrypt, upload blob, send attachment metadata envelope */
  async sendMedia(params: SendMediaParams): Promise<AttachmentContent> {
    if (!isAllowedMediaMime(params.mime)) {
      throw new Error(`Unsupported media type: ${params.mime}`);
    }

    const { encrypted, fileKey, digest, originalSize } = encryptMedia(params.data);

    await this.uploadBlob(params.blobId, params.recipientId, encrypted);

    const content: AttachmentContent = {
      kind: mediaKindFromMime(params.mime),
      blobId: params.blobId,
      mime: params.mime,
      fileName: params.fileName,
      size: originalSize,
      fileKey: encodeFileKey(fileKey),
      digest: digest,
    };

    const metaBytes = encodeContent(content);
    const padded = padToBucket(metaBytes, ATTACHMENT_META_BUCKET);
    this.options.transport.sendRaw(params.recipientId, params.messageId, padded);

    return content;
  }

  /** Download blob and decrypt using attachment metadata */
  async receiveMedia(content: AttachmentContent): Promise<Uint8Array> {
    const encrypted = await this.downloadBlob(content.blobId);
    const fileKey = decodeFileKey(content.fileKey);
    return decryptMedia(encrypted, fileKey, content.size);
  }

  /** Parse padded bucket bytes into message content */
  parseContent(paddedBucket: Uint8Array): MessageContent {
    return decodeContent(unpadFromBucket(paddedBucket));
  }

  /** Download, decrypt, and return media from padded envelope bytes */
  async handleIncoming(
    messageId: string,
    paddedBucket: Uint8Array,
  ): Promise<ReceivedMedia | null> {
    const content = this.parseContent(paddedBucket);
    if (content.kind === 'text') return null;

    const data = await this.receiveMedia(content);
    return { messageId, content, data };
  }

  /** Save decrypted media to disk */
  saveToFile(data: Uint8Array, filePath: string): void {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, data);
  }

  async uploadBlob(blobId: string, recipientId: string, data: Uint8Array): Promise<void> {
    const url = `${this.options.httpBaseUrl}/blob/${blobId}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Recipient-Id': recipientId,
      },
      body: data,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Blob upload failed (${res.status}): ${err}`);
    }
  }

  async downloadBlob(blobId: string): Promise<Uint8Array> {
    const url = `${this.options.httpBaseUrl}/blob/${blobId}`;
    const res = await fetch(url, {
      headers: { 'X-User-Id': this.options.userId },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Blob download failed (${res.status}): ${err}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Confirm blob saved locally — server deletes ephemeral copy */
  ackBlob(blobId: string): void {
    if (this.pendingBlobAcks.has(blobId)) return;
    this.pendingBlobAcks.add(blobId);
    this.options.transport.sendBlobAck(blobId);
  }

  static generateBlobId(): string {
    return randomBytes(16).toString('hex');
  }
}
