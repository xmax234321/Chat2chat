import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  decryptChunksParallel,
  decryptPackedBlob,
  encryptFileParallel,
  encryptFileStream,
  encryptFileToPackedBlob,
  packEncryptedChunks,
  unpackEncryptedBlob,
} from './index.js';

function makeBlob(size: number, seed = 7): Blob {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) data[i] = (i * seed) & 0xff;
  return new Blob([data]);
}

describe('chainlock-fastfile', () => {
  it('stream encrypt round-trip', async () => {
    const blob = makeBlob(600_000);
    const { fileKey, chunkSize, packed } = await encryptFileToPackedBlob(blob, { useWorkers: false });
    const { plaintext, failedIndices } = await decryptPackedBlob(packed, 600_000, { toleratePartial: true });
    assert.equal(failedIndices.length, 0);
    assert.equal(plaintext.length, 600_000);
    assert.equal(chunkSize, 65535);
    assert.equal(fileKey.length, 32);
  });

  it('out-of-order chunk decrypt', async () => {
    const blob = makeBlob(900_000);
    const { fileKey, chunkSize, chunks } = await encryptFileParallel(blob, { useWorkers: false });
    const shuffled = [...chunks].sort((a, b) => (a.index % 2) - (b.index % 2));
    const { decrypted, failed } = await decryptChunksParallel(fileKey, shuffled, { toleratePartial: true });
    assert.equal(failed.length, 0);
    assert.equal(decrypted.size, chunks.length);
    const out = new Uint8Array(900_000);
    for (const [index, plain] of decrypted) {
      out.set(plain, index * chunkSize);
    }
    const orig = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual(out, orig);
  });

  it('corrupted chunk fails without killing valid neighbors', async () => {
    const blob = makeBlob(900_000);
    const { fileKey, chunks } = await encryptFileParallel(blob, { useWorkers: false });
    const tampered = chunks.map((c) =>
      c.index === 1
        ? { ...c, authTag: new Uint8Array([...c.authTag.slice(0, 15), c.authTag[15]! ^ 0xff]) }
        : c,
    );
    const { decrypted, failed } = await decryptChunksParallel(fileKey, tampered, { toleratePartial: true });
    assert.deepEqual(failed, [1]);
    assert.ok(decrypted.has(0));
    assert.ok(decrypted.has(2));
  });

  it('streaming generator does not require full file buffer', async () => {
    const blob = makeBlob(512_000);
    const collected: number[] = [];
    for await (const chunk of encryptFileStream(blob, { useWorkers: false })) {
      collected.push(chunk.index);
    }
    assert.deepEqual(collected, [0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('pack/unpack preserves chunk count', async () => {
    const blob = makeBlob(100_000);
    const enc = await encryptFileParallel(blob, { useWorkers: false });
    const packed = packEncryptedChunks(enc.fileKey, enc.chunkSize, enc.chunks);
    const unpacked = unpackEncryptedBlob(packed);
    assert.equal(unpacked.chunks.length, enc.chunks.length);
    const hash = createHash('sha256').update(packed).digest('hex');
    assert.equal(hash.length, 64);
  });

  it('FF1 header layout matches spec', async () => {
    const blob = makeBlob(50_000);
    const enc = await encryptFileParallel(blob, { useWorkers: false });
    const packed = packEncryptedChunks(enc.fileKey, enc.chunkSize, enc.chunks);
    assert.equal(packed[0], 0x46);
    assert.equal(packed[1], 0x46);
    assert.equal(packed[2], 0x31);
    assert.equal(packed[3], 0x00);
    const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
    assert.equal(view.getUint32(4, false), enc.chunkSize);
    assert.deepEqual(packed.slice(8, 40), enc.fileKey);
    assert.equal(view.getUint32(40, false), enc.chunks.length);
  });
});
