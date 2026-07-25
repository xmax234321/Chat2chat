import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ChainLockSession } from '@chat2chat/chainlock-core';
import { encodeFileEnvelope, decodeFileEnvelope, type FileEnvelopeFields } from './proto.js';
import {
  assembleChunks,
  decryptChunk,
  encryptFileChunks,
  verifyChunkMerkle,
  encodeChunk,
  decodeChunk,
  DEFAULT_CHUNK_SIZE,
  type ChunkEncryptResult,
  type DecryptedChunk,
  type EncryptedChunk,
  type MerkleProofNode,
  type ChunkFields,
} from './chunk.js';

export interface FileMetadata {
  fileName: string;
  mime: string;
}

function encryptMetadata(fileKey: Uint8Array, meta: FileMetadata): {
  encryptedFilename: Uint8Array;
  encryptedMime: Uint8Array;
} {
  const nonce = randomBytes(12);
  const payload = new TextEncoder().encode(JSON.stringify(meta));
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(fileKey), nonce);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const blob = new Uint8Array(nonce.length + ciphertext.length + authTag.length);
  blob.set(nonce, 0);
  blob.set(ciphertext, nonce.length);
  blob.set(authTag, nonce.length + ciphertext.length);
  const half = Math.ceil(blob.length / 2);
  return {
    encryptedFilename: blob.subarray(0, half),
    encryptedMime: blob.subarray(half),
  };
}

function decryptMetadata(
  fileKey: Uint8Array,
  encryptedFilename: Uint8Array,
  encryptedMime: Uint8Array,
): FileMetadata {
  const blob = new Uint8Array(encryptedFilename.length + encryptedMime.length);
  blob.set(encryptedFilename, 0);
  blob.set(encryptedMime, encryptedFilename.length);
  const nonce = blob.subarray(0, 12);
  const authTag = blob.subarray(blob.length - 16);
  const ciphertext = blob.subarray(12, blob.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(fileKey), Buffer.from(nonce));
  decipher.setAuthTag(Buffer.from(authTag));
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(new TextDecoder().decode(plain)) as FileMetadata;
}

export interface ChainLockFileSendResult extends ChunkEncryptResult {
  envelopeBytes: Uint8Array;
  metadata: FileMetadata;
}

/** Encrypt file chunks and wrap file_key via ChainLock Double Ratchet channel. */
export async function encryptFileForSend(
  session: ChainLockSession,
  plaintext: Uint8Array,
  metadata: FileMetadata,
  chunkSize?: number,
): Promise<ChainLockFileSendResult> {
  const encrypted = encryptFileChunks(plaintext, chunkSize);
  const metaEnc = encryptMetadata(encrypted.fileKey, metadata);
  const wrappedFileKey = await session.encryptRaw(encrypted.fileKey);

  const envelopeBytes = encodeFileEnvelope({
    fileId: encrypted.fileId,
    chunkSize: encrypted.chunkSize,
    totalChunks: encrypted.chunks.length,
    wrappedFileKey,
    merkleRoot: encrypted.merkleRoot,
    encryptedFilename: metaEnc.encryptedFilename,
    encryptedMime: metaEnc.encryptedMime,
  });

  return { ...encrypted, envelopeBytes, metadata };
}

export interface ChainLockFileReceiveResult {
  plaintext: Uint8Array;
  metadata: FileMetadata;
  envelope: FileEnvelopeFields;
}

export interface ChunkWithProof {
  chunkBytes: Uint8Array;
  merkleProof: MerkleProofNode[];
}

/** Decrypt envelope, unwrap file key, verify/decrypt chunks (order-independent). */
export async function decryptFileFromChunks(
  session: ChainLockSession,
  envelopeBytes: Uint8Array,
  chunks: ChunkWithProof[],
  originalSize: number,
): Promise<ChainLockFileReceiveResult> {
  const envelope = decodeFileEnvelope(envelopeBytes);
  const fileKey = await session.decryptRaw(envelope.wrappedFileKey);
  const metadata = decryptMetadata(fileKey, envelope.encryptedFilename, envelope.encryptedMime);

  const decrypted: DecryptedChunk[] = [];

  for (const { chunkBytes, merkleProof } of chunks) {
    try {
      decrypted.push(decryptChunk(chunkBytes, fileKey, envelope.merkleRoot, merkleProof));
    } catch {
      /* skip corrupted chunk — caller can retry transfer for that index */
    }
  }

  if (decrypted.length === 0) {
    throw new Error('No valid chunks decrypted');
  }

  const plaintext = assembleChunks(decrypted, originalSize, envelope.chunkSize);
  return { plaintext, metadata, envelope };
}

export {
  encryptFileChunks,
  decryptChunk,
  assembleChunks,
  verifyChunkMerkle,
  encodeFileEnvelope,
  decodeFileEnvelope,
  encodeChunk,
  decodeChunk,
  DEFAULT_CHUNK_SIZE,
  type EncryptedChunk,
  type DecryptedChunk,
  type ChunkEncryptResult,
  type FileEnvelopeFields,
  type ChunkFields,
  type MerkleProofNode,
};
