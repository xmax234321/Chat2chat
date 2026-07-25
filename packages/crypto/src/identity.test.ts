import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateIdentity,
  identityFromMnemonic,
  parseUserId,
  verify,
  sign,
  contactDeepLink,
  formatFingerprint,
} from './identity.js';
import { encryptWithPassword, decryptWithPassword, padToBucket, unpadFromBucket } from './symmetric.js';
import { utf8ToBytes } from '@noble/hashes/utils';

describe('identity', () => {
  it('generates deterministic ID from mnemonic', () => {
    const a = generateIdentity(12);
    const b = identityFromMnemonic(a.mnemonic!);
    assert.equal(a.userId, b.userId);
    assert.equal(a.fingerprint, b.fingerprint);
    assert.ok(a.userId.startsWith('c2c_'));
    assert.ok(a.userId.length >= 90 && a.userId.length <= 100);
  });

  it('round-trips user ID parsing', () => {
    const id = generateIdentity();
    const parsed = parseUserId(id.userId);
    assert.equal(parsed.signingPublicKey.length, 32);
    assert.equal(parsed.dhPublicKey.length, 32);
  });

  it('signs and verifies', () => {
    const id = generateIdentity();
    const data = utf8ToBytes('hello');
    const sig = sign(id, data);
    assert.ok(verify(id.userId, data, sig));
  });

  it('builds contact deep link', () => {
    const id = generateIdentity();
    assert.equal(contactDeepLink(id.userId), `chat2chat://add/${id.userId}`);
  });

  it('formats fingerprint', () => {
    const formatted = formatFingerprint('abcdefghijklmnop');
    assert.equal(formatted, 'abcde fghij klmno p');
  });
});

describe('symmetric', () => {
  it('encrypts and decrypts with password', () => {
    const plain = utf8ToBytes('secret message');
    const enc = encryptWithPassword('strong-password', plain);
    const dec = decryptWithPassword('strong-password', enc);
    assert.deepEqual(dec, plain);
  });

  it('pads and unpads messages', () => {
    const plain = utf8ToBytes('hi');
    const padded = padToBucket(plain, 64);
    assert.equal(padded.length, 64);
    assert.deepEqual(unpadFromBucket(padded), plain);
  });
});
