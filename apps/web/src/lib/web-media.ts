import {
  isAllowedMediaMime,
  mediaKindFromMime,
  padToBucket,
  unpadFromBucket,
  base64UrlEncode,
  base64UrlDecode,
  utf8ToBytes,
} from '@chat2chat/crypto/browser';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  ATTACHMENT_META_BUCKET,
  decodeContent,
  type AttachmentContent,
  type GroupEnvelopeMeta,
  type MessageContent,
} from '@chat2chat/protocol';
import type { BrowserTransport } from './transport';
import { recordUploadBytes } from './connection-metrics';
import { decryptMediaFastFile, encryptMediaFastFile, isFastFilePacked } from './fast-file-crypto';

export interface WebMediaOptions {
  transport: BrowserTransport;
  userId: string;
  httpBaseUrl: string;
  signData?: (data: Uint8Array) => Uint8Array;
  getClientInfo?: () => { version: string; build: string } | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bytesToBase64(data: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function stringifyUnknown(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === 'string') {
      const max = typeof obj.maxSizeBytes === 'number' ? obj.maxSizeBytes : undefined;
      const received = typeof obj.receivedBytes === 'number' ? obj.receivedBytes : undefined;
      if (max && received) {
        return `${obj.error} (max ${Math.round(max / (1024 * 1024))} MB, got ${Math.round(received / (1024 * 1024))} MB)`;
      }
      return obj.error;
    }
  }
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export class WebMedia {
  private pendingBlobAcks = new Set<string>();

  constructor(private readonly options: WebMediaOptions) {}

  async send(params: {
    recipientId: string;
    messageId: string;
    blobId: string;
    data: Uint8Array;
    mime: string;
    fileName: string;
    durationMs?: number;
    groupId?: string;
    senderAlias?: string;
    ephemeral?: import('./ephemeral-media').EphemeralMedia;
    sentAt?: number;
    mediaGroupId?: string;
    mediaGroupIndex?: number;
    mediaGroupTotal?: number;
    caption?: string;
    groupMeta?: GroupEnvelopeMeta;
    onPhase?: (phase: 'encrypt' | 'upload', percent: number) => void;
  }): Promise<AttachmentContent> {
    if (!isAllowedMediaMime(params.mime)) throw new Error(`Unsupported: ${params.mime}`);
    params.onPhase?.('encrypt', 0);
    const { encrypted, fileKey, digest, originalSize } = await encryptMediaFastFile(params.data, {
      onProgress: (percent) => params.onPhase?.('encrypt', percent),
    });
    await this.upload(params.blobId, params.recipientId, encrypted, (loaded, total) => {
      if (!total) return;
      params.onPhase?.('upload', (loaded / total) * 100);
    });
    const content: AttachmentContent = {
      kind: mediaKindFromMime(params.mime),
      blobId: params.blobId,
      mime: params.mime,
      fileName: params.fileName,
      size: originalSize,
      fileKey: base64UrlEncode(fileKey),
      digest,
      ...(params.durationMs != null ? { durationMs: params.durationMs } : {}),
    };
    const clientInfo = this.options.getClientInfo?.();
    const meta = JSON.stringify({
      ...content,
      from: this.options.userId,
      ...(params.groupId ? { groupId: params.groupId } : {}),
      ...(params.senderAlias ? { senderAlias: params.senderAlias } : {}),
      ...(params.ephemeral ? { ephemeral: params.ephemeral } : {}),
      ...(params.sentAt != null ? { sentAt: params.sentAt } : {}),
      ...(params.mediaGroupId
        ? {
            mediaGroupId: params.mediaGroupId,
            mediaGroupIndex: params.mediaGroupIndex,
            mediaGroupTotal: params.mediaGroupTotal,
          }
        : {}),
      ...(params.caption ? { caption: params.caption } : {}),
      ...(clientInfo ? { appVersion: clientInfo.version, appBuild: clientInfo.build } : {}),
    });
    const padded = padToBucket(new TextEncoder().encode(meta), ATTACHMENT_META_BUCKET);
    this.options.transport.sendRaw(
      params.recipientId,
      params.messageId,
      padded,
      params.groupMeta,
    );
    return content;
  }

  async handleIncoming(messageId: string, bucket: Uint8Array) {
    const raw = unpadFromBucket(bucket);
    let content: MessageContent & { from?: string };
    try {
      const parsed = JSON.parse(new TextDecoder().decode(raw)) as MessageContent & { from?: string };
      if (parsed.kind && (parsed.kind === 'text' || ('blobId' in parsed && parsed.blobId))) {
        content = parsed;
      } else {
        content = decodeContent(raw) as MessageContent & { from?: string };
      }
    } catch {
      content = decodeContent(raw) as MessageContent & { from?: string };
    }
    if (content.kind === 'text') return null;
    const encrypted = await this.download(content.blobId);
    if (!isFastFilePacked(encrypted)) {
      throw new Error('Unsupported media encryption format');
    }
    const data = await decryptMediaFastFile(
      encrypted,
      base64UrlDecode(content.fileKey),
      content.size,
    );
    const appVersion = 'appVersion' in content ? (content as { appVersion?: string }).appVersion : undefined;
    const appBuild = 'appBuild' in content ? (content as { appBuild?: string }).appBuild : undefined;
    return { messageId, content, data, from: content.from, appVersion, appBuild };
  }

  ackBlob(blobId: string): void {
    if (this.pendingBlobAcks.has(blobId)) return;
    this.pendingBlobAcks.add(blobId);
    this.options.transport.sendBlobAck(blobId);
  }

  private blobUrl(blobId: string): string {
    const base = this.options.httpBaseUrl.replace(/\/$/, '');
    return `${base}/api/v1/blob/${blobId}`;
  }

  private uploadViaXhr(
    url: string,
    headers: Record<string, string>,
    data: Uint8Array,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
      if (onProgress) {
        let lastLoaded = 0;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            recordUploadBytes(Math.max(0, event.loaded - lastLoaded));
            lastLoaded = event.loaded;
            onProgress(event.loaded, event.total);
          }
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(new Blob([new Uint8Array(data)], { type: 'application/octet-stream' }));
    });
  }

  private async upload(
    blobId: string,
    recipientId: string,
    data: Uint8Array,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    if (!this.options.signData) throw new Error('Missing signing identity for blob upload');
    const url = this.blobUrl(blobId);
    const timestamp = Date.now();
    const message = `blob-put:${blobId}:${recipientId}:${timestamp}`;
    const signature = base64UrlEncode(this.options.signData(utf8ToBytes(message)));
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-Recipient-Id': recipientId,
      'X-Sender-Id': this.options.userId,
      'X-Timestamp': String(timestamp),
      'X-Signature': signature,
    };

    if (Capacitor.isNativePlatform()) {
      try {
        await this.uploadViaXhr(url, headers, data, onProgress);
        return;
      } catch {
        /* fall through */
      }
    }

    try {
      const body = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
      recordUploadBytes(data.length);
      const res = await fetch(url, { method: 'PUT', headers, body });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 413) {
          let detail = 'file too large for server limit';
          try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const msg = stringifyUnknown(parsed);
            if (msg) detail = msg;
          } catch {
            if (text) detail = text;
          }
          throw new Error(`Upload failed (413): ${detail}`);
        }
        throw new Error(`Upload failed (${res.status})${text ? `: ${text}` : ''}`);
      }
      return;
    } catch (fetchError) {
      if (!Capacitor.isNativePlatform()) throw fetchError;
    }

    try {
      await this.uploadViaXhr(url, headers, data, onProgress);
      return;
    } catch {
      /* fall through to CapacitorHttp */
    }

    const res = await CapacitorHttp.request({
      method: 'PUT',
      url,
      headers,
      data: bytesToBase64(data),
      dataType: 'file',
    });
    if (res.status < 200 || res.status >= 300) {
      if (res.status === 413) {
        const detail = stringifyUnknown(res.data) || 'file too large for server limit';
        throw new Error(`Upload failed (413): ${detail}`);
      }
      const detail = stringifyUnknown(res.data);
      throw new Error(`Upload failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
  }

  private downloadViaXhr(url: string, headers: Record<string, string>): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
      xhr.timeout = 600_000;
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          resolve(new Uint8Array(xhr.response as ArrayBuffer));
          return;
        }
        reject(new Error(`Download failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Download failed'));
      xhr.ontimeout = () => reject(new Error('Download failed'));
      xhr.send();
    });
  }

  private async download(blobId: string): Promise<Uint8Array> {
    if (!this.options.signData) throw new Error('Missing signing identity for blob download');
    const url = this.blobUrl(blobId);
    const timestamp = Date.now();
    const message = `blob-get:${blobId}:${timestamp}`;
    const signature = base64UrlEncode(this.options.signData(utf8ToBytes(message)));
    const headers = {
      'X-User-Id': this.options.userId,
      'X-Timestamp': String(timestamp),
      'X-Signature': signature,
    };

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        if (Capacitor.isNativePlatform()) {
          try {
            const data = await this.downloadViaXhr(url, headers);
            if (data.length) return data;
          } catch {
            /* fall through */
          }
        }
        const res = await fetch(url, { headers });
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
        if (res.status === 404 && attempt < 7) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        const err = await res.text().catch(() => '');
        throw new Error(`Download failed (${res.status})${err ? `: ${err}` : ''}`);
      } catch (e) {
        if (attempt < 7) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        throw e;
      }
    }
    throw new Error('Download failed');
  }

  static blobId(): string {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
}
