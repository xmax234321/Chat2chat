export {
  generateFileKey,
  concatBytes,
  DEFAULT_CHUNK_SIZE,
  FASTFILE_MAGIC,
  FILE_KEY_BYTES,
  NONCE_BYTES,
  AUTH_TAG_BYTES,
  type EncryptedChunkPacket,
  type FastFileEncryptResult,
  type FastFileDecryptResult,
} from './types.js';

export {
  ChunkNonceDeriver,
  importAesGcmKey,
  encryptAesGcm,
  decryptAesGcm,
} from './nonce.js';

export { WorkerPool, type WorkerPoolOptions } from './worker-pool.js';

export {
  encryptFileStream,
  encryptFileParallel,
  packEncryptedChunks,
  encryptFileToPackedBlob,
  type StreamEncryptOptions,
  type EncryptFileStreamOptions,
} from './stream-encrypt.js';

export {
  unpackEncryptedBlob,
  decryptChunksParallel,
  decryptPackedBlob,
  decryptChunkStream,
  type PackedFastFile,
  type DecryptChunkInput,
  type StreamDecryptOptions,
} from './stream-decrypt.js';
