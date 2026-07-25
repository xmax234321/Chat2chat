import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChainLockSession,
  ChainLockIdentity,
  RatchetSession,
} from '@chat2chat/chainlock-core';
import {
  decryptChunk,
  encryptFileChunks,
  assembleChunks,
  decryptFileFromChunks,
  encryptFileForSend,
  encodeChunk,
  decodeChunk,
} from './index.js';

async function pairSessions(): Promise<{ alice: ChainLockSession; bob: ChainLockSession }> {
  const aliceIdentity = ChainLockIdentity.generate();
  const bobIdentity = ChainLockIdentity.generate();
  const alice = await ChainLockSession.establishOutbound(
    aliceIdentity.stores,
    'bob-user',
    bobIdentity.bundleData,
  );
  const bob = ChainLockSession.fromRatchet(RatchetSession.fromStores(bobIdentity.stores, 'alice-user'));
  return { alice, bob };
}

describe('chainlock-files', () => {
  it('decrypts chunks in arbitrary order', () => {
    const plain = new Uint8Array(200 * 1024);
    for (let i = 0; i < plain.length; i += 1) plain[i] = i % 256;

    const enc = encryptFileChunks(plain, 32 * 1024);
    const decrypted = enc.chunks
      .slice()
      .reverse()
      .map((c) => decryptChunk(c.encoded, enc.fileKey, enc.merkleRoot, c.merkleProof));

    const assembled = assembleChunks(decrypted, plain.length, enc.chunkSize);
    assert.deepEqual(assembled, plain);
  });

  it('rejects corrupted chunk without failing valid chunks', async () => {
    const plain = new Uint8Array(96 * 1024);
    plain.fill(7);
    const { alice, bob } = await pairSessions();
    const sent = await encryptFileForSend(alice, plain, { fileName: 'test.bin', mime: 'application/octet-stream' }, 32 * 1024);

    const chunks = sent.chunks.map((c) => ({
      chunkBytes: c.encoded.slice(),
      merkleProof: c.merkleProof,
    }));
    assert.ok(chunks.length >= 2);

    const corrupt = decodeChunk(chunks[1]!.chunkBytes);
    corrupt.ciphertext = corrupt.ciphertext.slice();
    corrupt.ciphertext[0] ^= 0xff;
    chunks[1]!.chunkBytes = new Uint8Array(encodeChunk(corrupt));

    await assert.rejects(
      async () => {
        decryptChunk(chunks[1]!.chunkBytes, sent.fileKey, sent.merkleRoot, chunks[1]!.merkleProof);
      },
      /Merkle verification failed|Unsupported state|unable to authenticate/i,
    );

    const goodOnly = [chunks[0]!];
    const partial = await decryptFileFromChunks(bob, sent.envelopeBytes, goodOnly, plain.length);
    assert.ok(partial.plaintext.length <= plain.length);
    assert.notDeepEqual(partial.plaintext, plain);
  });

  it('round-trips file via ChainLock envelope', async () => {
    const plain = new Uint8Array(150 * 1024);
    for (let i = 0; i < plain.length; i += 1) plain[i] = (i * 17) % 256;

    const { alice, bob } = await pairSessions();
    const sent = await encryptFileForSend(alice, plain, { fileName: 'photo.png', mime: 'image/png' });

    const shuffled = sent.chunks
      .map((c) => ({ chunkBytes: c.encoded, merkleProof: c.merkleProof }))
      .sort(() => Math.random() - 0.5);

    const received = await decryptFileFromChunks(bob, sent.envelopeBytes, shuffled, plain.length);

    assert.deepEqual(received.plaintext, plain);
    assert.equal(received.metadata.fileName, 'photo.png');
    assert.equal(received.metadata.mime, 'image/png');
  });
});
