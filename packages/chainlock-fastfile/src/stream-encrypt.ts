import {
  AUTH_TAG_BYTES,
  concatBytes,
  DEFAULT_CHUNK_SIZE,
  FASTFILE_MAGIC,
  type EncryptedChunkPacket,
  generateFileKey,
} from './types.js';
import { ChunkNonceDeriver, encryptAesGcm, importAesGcmKey } from './nonce.js';
import { WorkerPool, type WorkerPoolOptions } from './worker-pool.js';

export interface StreamEncryptOptions {
  chunkSize?: number;
  fileKey?: Uint8Array;
  workerPool?: WorkerPool | null;
  workerPoolOptions?: WorkerPoolOptions;
  onChunk?: (chunk: EncryptedChunkPacket, done: number, total: number | null) => void;
}

export interface EncryptFileStreamOptions extends StreamEncryptOptions {
  useWorkers?: boolean;
}

/** Sequential stream encrypt — constant memory, yields chunks as ready. */
export async function* encryptFileStream(
  file: Blob,
  options: EncryptFileStreamOptions = {},
): AsyncGenerator<EncryptedChunkPacket> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const fileKey = options.fileKey ?? generateFileKey();
  const aesKey = await importAesGcmKey(fileKey);
  const nonceDeriver = await ChunkNonceDeriver.fromFileKey(fileKey);

  const stream = file.stream();
  const reader = stream.getReader();
  let index = 0;
  let buffer: Uint8Array = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value?.length) buffer = concatBytes(buffer, value);

      while (buffer.length >= chunkSize || (done && buffer.length > 0)) {
        const chunkLen = Math.min(chunkSize, buffer.length);
        const chunk = buffer.slice(0, chunkLen);
        buffer = buffer.slice(chunkLen);

        const nonce = await nonceDeriver.derive(index);
        const { ciphertext, authTag } = await encryptAesGcm(aesKey, nonce, chunk);
        yield { index, nonce, ciphertext, authTag };
        index += 1;

        if (buffer.length === 0) break;
      }

      if (done && buffer.length === 0) break;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parallel encrypt via worker pool; results may arrive out of order. */
export async function encryptFileParallel(
  file: Blob,
  options: EncryptFileStreamOptions = {},
): Promise<{ fileKey: Uint8Array; chunkSize: number; chunks: EncryptedChunkPacket[] }> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const fileKey = options.fileKey ?? generateFileKey();
  const useWorkers = options.useWorkers !== false && typeof Worker !== 'undefined';

  let pool = options.workerPool ?? null;
  let ownPool = false;
  if (useWorkers && !pool) {
    pool = await WorkerPool.create(fileKey, options.workerPoolOptions);
    ownPool = true;
  }

  const nonceDeriver = await ChunkNonceDeriver.fromFileKey(fileKey);
  const aesKey = await importAesGcmKey(fileKey);
  const pending: Promise<EncryptedChunkPacket>[] = [];

  const stream = file.stream();
  const reader = stream.getReader();
  let buffer: Uint8Array = new Uint8Array(0);
  let index = 0;
  let totalEstimate: number | null = file.size ? Math.ceil(file.size / chunkSize) : null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value?.length) buffer = concatBytes(buffer, value);

      while (buffer.length >= chunkSize || (done && buffer.length > 0)) {
        const chunkLen = Math.min(chunkSize, buffer.length);
        const plaintext = buffer.slice(0, chunkLen);
        buffer = buffer.slice(chunkLen);
        const chunkIndex = index;
        index += 1;

        const noncePromise = nonceDeriver.derive(chunkIndex);
        const task = noncePromise.then(async (nonce) => {
          if (pool && pool.size > 0) {
            const result = await pool.encryptChunk(chunkIndex, nonce, plaintext);
            return {
              index: result.index,
              nonce,
              ciphertext: result.ciphertext,
              authTag: result.authTag,
            };
          }
          const { ciphertext, authTag } = await encryptAesGcm(aesKey, nonce, plaintext);
          return { index: chunkIndex, nonce, ciphertext, authTag };
        });

        pending.push(
          task.then((packet) => {
            options.onChunk?.(packet, pending.length, totalEstimate);
            return packet;
          }),
        );
      }

      if (done && buffer.length === 0) break;
    }
  } finally {
    reader.releaseLock();
    if (ownPool && pool) pool.close();
  }

  const chunks = await Promise.all(pending);
  chunks.sort((a, b) => a.index - b.index);
  return { fileKey, chunkSize, chunks };
}

/** Collect encrypted chunks into a single blob for legacy blob upload. */
export function packEncryptedChunks(
  fileKey: Uint8Array,
  chunkSize: number,
  chunks: EncryptedChunkPacket[],
): Uint8Array {
  const headerSize = 4 + 4 + 32 + 4;
  let body = 0;
  for (const c of chunks) {
    body += 4 + 12 + 2 + c.ciphertext.length + AUTH_TAG_BYTES;
  }
  const out = new Uint8Array(headerSize + body);
  const view = new DataView(out.buffer);
  out.set(FASTFILE_MAGIC, 0);
  view.setUint32(4, chunkSize, false);
  out.set(fileKey, 8);
  view.setUint32(40, chunks.length, false);
  let offset = headerSize;
  for (const c of chunks) {
    view.setUint32(offset, c.index, false);
    offset += 4;
    out.set(c.nonce, offset);
    offset += 12;
    view.setUint16(offset, c.ciphertext.length, false);
    offset += 2;
    out.set(c.ciphertext, offset);
    offset += c.ciphertext.length;
    out.set(c.authTag, offset);
    offset += AUTH_TAG_BYTES;
  }
  return out;
}

export async function encryptFileToPackedBlob(
  file: Blob,
  options: EncryptFileStreamOptions = {},
): Promise<{ fileKey: Uint8Array; chunkSize: number; packed: Uint8Array; chunks: EncryptedChunkPacket[] }> {
  const { fileKey, chunkSize, chunks } = await encryptFileParallel(file, options);
  const packed = packEncryptedChunks(fileKey, chunkSize, chunks);
  return { fileKey, chunkSize, packed, chunks };
}
