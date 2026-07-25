import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { MerkleTree } from 'merkletreejs';
import { encodeChunk, decodeChunk, type ChunkFields } from './proto.js';

export const DEFAULT_CHUNK_SIZE = 64 * 1024;
export const FILE_ID_LENGTH = 16;
export const NONCE_LENGTH = 12;
export const AUTH_TAG_LENGTH = 16;
export const MERKLE_HASH = 'sha256';

export type MerkleProofNode = { position: 'left' | 'right'; data: Buffer };

export interface EncryptedChunk {
  index: number;
  encoded: Uint8Array;
  leafHash: Buffer;
  merkleProof: MerkleProofNode[];
}

export interface ChunkEncryptResult {
  fileId: Uint8Array;
  fileKey: Uint8Array;
  chunkSize: number;
  chunks: EncryptedChunk[];
  merkleRoot: Uint8Array;
}

function deriveChunkNonce(fileKey: Uint8Array, index: number): Buffer {
  const info = Buffer.from(`chainlock-chunk-nonce-v1:${index}`);
  return Buffer.from(hkdfSync('sha256', Buffer.from(fileKey), Buffer.alloc(0), info, NONCE_LENGTH));
}

function encryptAesGcm(key: Uint8Array, nonce: Buffer, plaintext: Uint8Array): {
  ciphertext: Uint8Array;
  authTag: Uint8Array;
} {
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: new Uint8Array(ciphertext), authTag: new Uint8Array(authTag) };
}

function decryptAesGcm(
  key: Uint8Array,
  nonce: Buffer,
  ciphertext: Uint8Array,
  authTag: Uint8Array,
): Uint8Array {
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), nonce);
  decipher.setAuthTag(Buffer.from(authTag));
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return new Uint8Array(plain);
}

function chunkLeafHash(index: number, nonce: Uint8Array, ciphertext: Uint8Array, authTag: Uint8Array): Buffer {
  const idx = Buffer.alloc(4);
  idx.writeUInt32BE(index, 0);
  return createHash(MERKLE_HASH)
    .update(idx)
    .update(nonce)
    .update(ciphertext)
    .update(authTag)
    .digest();
}

function hashFn(data: Buffer): Buffer {
  return createHash(MERKLE_HASH).update(data).digest();
}

/** Split file into AES-256-GCM chunks with HKDF-derived nonces and Merkle leaves. */
export function encryptFileChunks(
  plaintext: Uint8Array,
  chunkSize = DEFAULT_CHUNK_SIZE,
): ChunkEncryptResult {
  const fileId = new Uint8Array(randomBytes(FILE_ID_LENGTH));
  const fileKey = new Uint8Array(randomBytes(32));
  const chunkEntries: Array<{ index: number; encoded: Uint8Array; leafHash: Buffer }> = [];

  const totalChunks = Math.max(1, Math.ceil(plaintext.length / chunkSize));
  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * chunkSize;
    const slice = plaintext.subarray(start, start + chunkSize);
    const nonce = deriveChunkNonce(fileKey, index);
    const { ciphertext, authTag } = encryptAesGcm(fileKey, nonce, slice);
    const leafHash = chunkLeafHash(index, nonce, ciphertext, authTag);
    const encoded = encodeChunk({ index, nonce: new Uint8Array(nonce), ciphertext, authTag });
    chunkEntries.push({ index, encoded, leafHash });
  }

  const leaves = chunkEntries.map((c) => c.leafHash);
  const tree = new MerkleTree(leaves, hashFn, { sortPairs: true });
  const merkleRoot = new Uint8Array(tree.getRoot());

  const chunks: EncryptedChunk[] = chunkEntries.map((entry) => ({
    index: entry.index,
    encoded: entry.encoded,
    leafHash: entry.leafHash,
    merkleProof: tree.getProof(entry.leafHash) as MerkleProofNode[],
  }));

  return { fileId, fileKey, chunkSize, chunks, merkleRoot };
}

export interface DecryptedChunk {
  index: number;
  plaintext: Uint8Array;
}

/** Decrypt a single chunk and verify its Merkle proof against the root. */
export function decryptChunk(
  chunkBytes: Uint8Array,
  fileKey: Uint8Array,
  merkleRoot: Uint8Array,
  merkleProof?: MerkleProofNode[],
): DecryptedChunk {
  const chunk = decodeChunk(chunkBytes);
  if (chunk.nonce.length !== NONCE_LENGTH) throw new Error('Invalid chunk nonce length');
  if (chunk.authTag.length !== AUTH_TAG_LENGTH) throw new Error('Invalid chunk auth tag length');

  const leaf = chunkLeafHash(chunk.index, chunk.nonce, chunk.ciphertext, chunk.authTag);
  if (merkleProof) {
    const ok = MerkleTree.verify(merkleProof, leaf, Buffer.from(merkleRoot), hashFn, { sortPairs: true });
    if (!ok) throw new Error(`Merkle verification failed for chunk ${chunk.index}`);
  }

  const plaintext = decryptAesGcm(fileKey, Buffer.from(chunk.nonce), chunk.ciphertext, chunk.authTag);
  return { index: chunk.index, plaintext };
}

/** Reassemble file from chunks received in any order. */
export function assembleChunks(
  decrypted: DecryptedChunk[],
  totalSize: number,
  chunkSize: number,
): Uint8Array {
  const sorted = [...decrypted].sort((a, b) => a.index - b.index);
  const out = new Uint8Array(totalSize);
  for (const part of sorted) {
    const offset = part.index * chunkSize;
    out.set(part.plaintext.subarray(0, out.length - offset), offset);
  }
  return out;
}

export function verifyChunkMerkle(
  chunk: ChunkFields,
  merkleRoot: Uint8Array,
  merkleProof: MerkleProofNode[],
): boolean {
  const leaf = chunkLeafHash(chunk.index, chunk.nonce, chunk.ciphertext, chunk.authTag);
  return MerkleTree.verify(merkleProof, leaf, Buffer.from(merkleRoot), hashFn, { sortPairs: true });
}

export function chunkLeafForFields(chunk: ChunkFields): Buffer {
  return chunkLeafHash(chunk.index, chunk.nonce, chunk.ciphertext, chunk.authTag);
}

export { encodeChunk, decodeChunk, type ChunkFields };
