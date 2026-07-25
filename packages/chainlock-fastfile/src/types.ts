export const FILE_KEY_BYTES = 32;
export const NONCE_BYTES = 12;
export const AUTH_TAG_BYTES = 16;
/** Max plaintext per chunk; ctLen in FF1 pack is u16. */
export const DEFAULT_CHUNK_SIZE = 65535;
export const FASTFILE_MAGIC = new Uint8Array([0x46, 0x46, 0x31, 0x00]); // "FF1\0"

export interface EncryptedChunkPacket {
  index: number;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
}

export interface FastFileEncryptResult {
  fileKey: Uint8Array;
  chunkSize: number;
  chunks: EncryptedChunkPacket[];
  packed: Uint8Array;
}

export interface FastFileDecryptResult {
  plaintext: Uint8Array;
  decryptedCount: number;
  failedIndices: number[];
}

export function generateFileKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(FILE_KEY_BYTES));
}

export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b.slice();
  if (b.length === 0) return a.slice();
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Standalone ArrayBuffer for WebCrypto BufferSource (TS 5.7 + Node DOM lib). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
