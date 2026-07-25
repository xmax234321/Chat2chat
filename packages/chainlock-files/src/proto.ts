import protobuf from 'protobufjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const protoPath = join(dirname(fileURLToPath(import.meta.url)), '../proto/files.proto');
const root = protobuf.parse(readFileSync(protoPath, 'utf8')).root;

export const FileEnvelope = root.lookupType('chainlock.files.FileEnvelope');
export const Chunk = root.lookupType('chainlock.files.Chunk');

export interface FileEnvelopeFields {
  fileId: Uint8Array;
  chunkSize: number;
  totalChunks: number;
  wrappedFileKey: Uint8Array;
  merkleRoot: Uint8Array;
  encryptedFilename: Uint8Array;
  encryptedMime: Uint8Array;
}

export interface ChunkFields {
  index: number;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
}

export function encodeFileEnvelope(fields: FileEnvelopeFields): Uint8Array {
  const msg = FileEnvelope.create({
    fileId: fields.fileId,
    chunkSize: fields.chunkSize,
    totalChunks: fields.totalChunks,
    wrappedFileKey: fields.wrappedFileKey,
    merkleRoot: fields.merkleRoot,
    encryptedFilename: fields.encryptedFilename,
    encryptedMime: fields.encryptedMime,
  });
  return Uint8Array.from(FileEnvelope.encode(msg).finish());
}

export function decodeFileEnvelope(bytes: Uint8Array): FileEnvelopeFields {
  const decoded = FileEnvelope.decode(bytes) as protobuf.Message;
  const obj = FileEnvelope.toObject(decoded, { bytes: Uint8Array }) as FileEnvelopeFields;
  return {
    fileId: obj.fileId,
    chunkSize: obj.chunkSize >>> 0,
    totalChunks: obj.totalChunks >>> 0,
    wrappedFileKey: obj.wrappedFileKey,
    merkleRoot: obj.merkleRoot,
    encryptedFilename: obj.encryptedFilename,
    encryptedMime: obj.encryptedMime,
  };
}

export function encodeChunk(fields: ChunkFields): Uint8Array {
  const msg = Chunk.create({
    index: fields.index,
    nonce: fields.nonce,
    ciphertext: fields.ciphertext,
    authTag: fields.authTag,
  });
  return Uint8Array.from(Chunk.encode(msg).finish());
}

export function decodeChunk(bytes: Uint8Array): ChunkFields {
  const decoded = Chunk.decode(bytes) as protobuf.Message;
  const obj = Chunk.toObject(decoded, { bytes: Uint8Array }) as ChunkFields;
  return {
    index: obj.index >>> 0,
    nonce: obj.nonce,
    ciphertext: obj.ciphertext,
    authTag: obj.authTag,
  };
}
