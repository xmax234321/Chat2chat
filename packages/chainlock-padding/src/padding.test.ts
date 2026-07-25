import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { padToBucket, unpadFromBucket, selectBucket, PADDING_BUCKETS } from './index.js';

describe('chainlock-padding', () => {
  it('selects smallest fitting bucket', () => {
    assert.equal(selectBucket(10), 256);
    assert.equal(selectBucket(250), 256);
    assert.equal(selectBucket(1020), 1024);
    assert.equal(selectBucket(16 * 1024 - 3), 16 * 1024);
  });

  it('pads and unpads round-trip', () => {
    const plain = new TextEncoder().encode('hello chainlock');
    const padded = padToBucket(plain);
    assert.ok(PADDING_BUCKETS.includes(padded.length as (typeof PADDING_BUCKETS)[number]));
    assert.deepEqual(unpadFromBucket(padded), plain);
  });

  it('rejects oversized payload', () => {
    assert.throws(() => padToBucket(new Uint8Array(256 * 1024)));
  });
});
