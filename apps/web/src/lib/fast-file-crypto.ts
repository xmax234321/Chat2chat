import {
  decryptPackedBlob,
  encryptFileStream,
  generateFileKey,
  packEncryptedChunks,
  unpackEncryptedBlob,
  DEFAULT_CHUNK_SIZE,
  type EncryptFileStreamOptions,
} from '@chat2chat/chainlock-fastfile';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * FastLane media encrypt — sequential WebCrypto AES-GCM stream.
 * Avoids worker pool + parallel chunk queue (OOM/hangs on iOS WKWebView).
 */
export async function encryptMediaFastFile(
  data: Uint8Array,
  options: EncryptFileStreamOptions & { onProgress?: (percent: number) => void } = {},
): Promise<{ encrypted: Uint8Array; fileKey: Uint8Array; digest: string; originalSize: number }> {
  const blob = new Blob([toArrayBuffer(data)]);
  const digest = await sha256Hex(data);
  const fileKey = options.fileKey ?? generateFileKey();
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const totalChunks = Math.max(1, Math.ceil(data.length / chunkSize));
  const chunks = [];
  let done = 0;
  for await (const chunk of encryptFileStream(blob, {
    ...options,
    fileKey,
    chunkSize,
    useWorkers: false,
  })) {
    chunks.push(chunk);
    done += 1;
    options.onProgress?.(Math.min(100, Math.round((done / totalChunks) * 100)));
  }
  const packed = packEncryptedChunks(fileKey, chunkSize, chunks);
  return { encrypted: packed, fileKey, digest, originalSize: data.length };
}

export function isFastFilePacked(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x46 && data[1] === 0x46 && data[2] === 0x31 && data[3] === 0x00;
}

function fileKeysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function decryptMediaFastFile(
  encrypted: Uint8Array,
  fileKey: Uint8Array,
  originalSize: number,
): Promise<Uint8Array> {
  const packed = unpackEncryptedBlob(encrypted);
  if (!fileKeysEqual(packed.fileKey, fileKey)) {
    throw new Error('FastFile fileKey mismatch');
  }
  const { plaintext, failedIndices } = await decryptPackedBlob(encrypted, originalSize, {
    toleratePartial: false,
  });
  if (failedIndices.length > 0) {
    throw new Error(`FastFile decrypt failed for chunks: ${failedIndices.join(', ')}`);
  }
  return plaintext;
}
