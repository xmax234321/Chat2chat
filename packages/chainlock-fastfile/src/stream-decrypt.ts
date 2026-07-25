import { AUTH_TAG_BYTES, FASTFILE_MAGIC, type EncryptedChunkPacket, type FastFileDecryptResult } from './types.js';
import { decryptAesGcm, importAesGcmKey } from './nonce.js';

export interface PackedFastFile {
  chunkSize: number;
  fileKey: Uint8Array;
  chunks: EncryptedChunkPacket[];
  originalSize?: number;
}

export interface DecryptChunkInput {
  index: number;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
}

export interface StreamDecryptOptions {
  parallel?: number;
  /** If true, failed chunks are recorded but do not abort other decrypt tasks. */
  toleratePartial?: boolean;
  onChunk?: (index: number, plaintext: Uint8Array) => void;
}

/** Parse FF1 packed blob produced by packEncryptedChunks. */
export function unpackEncryptedBlob(packed: Uint8Array): PackedFastFile {
  if (packed.length < 44) throw new Error('Invalid FastFile blob');
  for (let i = 0; i < FASTFILE_MAGIC.length; i += 1) {
    if (packed[i] !== FASTFILE_MAGIC[i]) throw new Error('Invalid FastFile magic');
  }
  const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  const chunkSize = view.getUint32(4, false);
  const fileKey = packed.slice(8, 40);
  const count = view.getUint32(40, false);
  const chunks: EncryptedChunkPacket[] = [];
  let offset = 44;
  for (let i = 0; i < count; i += 1) {
    const index = view.getUint32(offset, false);
    offset += 4;
    const nonce = packed.slice(offset, offset + 12);
    offset += 12;
    const ctLen = view.getUint16(offset, false);
    offset += 2;
    const ciphertext = packed.slice(offset, offset + ctLen);
    offset += ctLen;
    const authTag = packed.slice(offset, offset + AUTH_TAG_BYTES);
    offset += AUTH_TAG_BYTES;
    chunks.push({ index, nonce, ciphertext, authTag });
  }
  return { chunkSize, fileKey, chunks };
}

/** Decrypt chunks in parallel; fail-fast per chunk unless toleratePartial. */
export async function decryptChunksParallel(
  fileKey: Uint8Array,
  chunks: DecryptChunkInput[],
  options: StreamDecryptOptions = {},
): Promise<{ decrypted: Map<number, Uint8Array>; failed: number[] }> {
  const aesKey = await importAesGcmKey(fileKey);
  const parallel = options.parallel ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4);
  const decrypted = new Map<number, Uint8Array>();
  const failed: number[] = [];

  let cursor = 0;
  const workers = Array.from({ length: Math.min(parallel, chunks.length) }, async () => {
    while (cursor < chunks.length) {
      const i = cursor++;
      const chunk = chunks[i]!;
      try {
        const plain = await decryptAesGcm(aesKey, chunk.nonce, chunk.ciphertext, chunk.authTag);
        decrypted.set(chunk.index, plain);
        options.onChunk?.(chunk.index, plain);
      } catch {
        failed.push(chunk.index);
        if (!options.toleratePartial) throw new Error(`Chunk ${chunk.index} auth failed`);
      }
    }
  });

  await Promise.all(workers);
  return { decrypted, failed };
}

export async function decryptPackedBlob(
  packed: Uint8Array,
  originalSize: number,
  options: StreamDecryptOptions = {},
): Promise<FastFileDecryptResult> {
  const { chunkSize, fileKey, chunks } = unpackEncryptedBlob(packed);
  const { decrypted, failed } = await decryptChunksParallel(fileKey, chunks, {
    ...options,
    toleratePartial: options.toleratePartial ?? true,
  });

  const sorted = [...decrypted.entries()].sort((a, b) => a[0] - b[0]);
  const out = new Uint8Array(originalSize);
  for (const [index, plain] of sorted) {
    const offset = index * chunkSize;
    out.set(plain.subarray(0, Math.max(0, out.length - offset)), offset);
  }

  return {
    plaintext: out,
    decryptedCount: decrypted.size,
    failedIndices: failed,
  };
}

/** Streaming decrypt generator — yields plaintext chunks in index order when possible. */
export async function* decryptChunkStream(
  fileKey: Uint8Array,
  _chunkSize: number,
  incoming: AsyncIterable<DecryptChunkInput>,
): AsyncGenerator<{ index: number; plaintext: Uint8Array }> {
  const aesKey = await importAesGcmKey(fileKey);
  for await (const chunk of incoming) {
    try {
      const plaintext = await decryptAesGcm(aesKey, chunk.nonce, chunk.ciphertext, chunk.authTag);
      yield { index: chunk.index, plaintext };
    } catch (e) {
      throw new Error(`Chunk ${chunk.index} decrypt failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
