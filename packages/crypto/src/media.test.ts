import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptMedia, decryptMedia } from './media.js';

describe('media', () => {
  it('encrypts and decrypts small image', () => {
    const plain = new Uint8Array(1024).fill(42);
    const enc = encryptMedia(plain);
    const dec = decryptMedia(enc.encrypted, enc.fileKey, enc.originalSize);
    assert.deepEqual(dec, plain);
  });

  it('encrypts and decrypts large video (chunked)', () => {
    const plain = new Uint8Array(200 * 1024);
    for (let i = 0; i < plain.length; i++) plain[i] = i % 256;
    const enc = encryptMedia(plain);
    const dec = decryptMedia(enc.encrypted, enc.fileKey, enc.originalSize);
    assert.deepEqual(dec, plain);
  });
});
