import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChainLockSession,
  ChainLockIdentity,
  generatePreKeyBundleData,
  createProtocolStores,
  RatchetSession,
  SKIP_LIMIT,
  decodeChainLockPacket,
} from './index.js';
import { unpadFromBucket } from '@chat2chat/chainlock-padding';

async function pairSessions(): Promise<{ alice: ChainLockSession; bob: ChainLockSession }> {
  const aliceIdentity = ChainLockIdentity.generate();
  const bobIdentity = ChainLockIdentity.generate();

  const alice = await ChainLockSession.establishOutbound(
    aliceIdentity.stores,
    'bob-user',
    bobIdentity.bundleData,
  );
  const bobRatchet = RatchetSession.fromStores(bobIdentity.stores, 'alice-user');
  const bob = ChainLockSession.fromRatchet(bobRatchet);
  return { alice, bob };
}

describe('chainlock-core session', () => {
  it('encrypts and decrypts a message', async () => {
    const { alice, bob } = await pairSessions();
    const plain = new TextEncoder().encode('ChainLock hello');
    const padded = await alice.encrypt(plain);
    const result = await bob.decrypt(padded);
    assert.deepEqual(result.plaintext, plain);
    assert.ok(result.exactTimestamp > 0);
    assert.ok(result.serverTimestamp <= result.exactTimestamp);
  });

  it('round-trips multiple messages', async () => {
    const { alice, bob } = await pairSessions();
    for (let i = 0; i < 5; i += 1) {
      const plain = new TextEncoder().encode(`msg-${i}`);
      const padded = await alice.encrypt(plain);
      const result = await bob.decrypt(padded);
      assert.deepEqual(result.plaintext, plain);
    }
  });

  it('rejects when skip limit exceeded', async () => {
    const aliceBundle = generatePreKeyBundleData();
    const bobBundle = generatePreKeyBundleData();
    const aliceStores = createProtocolStores(aliceBundle);
    const bobStores = createProtocolStores(bobBundle);

    const alice = await ChainLockSession.establishOutbound(aliceStores, 'bob', bobBundle);
    const bob = ChainLockSession.fromRatchet(RatchetSession.fromStores(bobStores, 'alice'));

    const padded = await alice.encrypt(new TextEncoder().encode('late'));
    const packet = decodeChainLockPacket(unpadFromBucket(padded));
    bob.restoreState({
      receiveByChain: new Map([[packet.chainTag, { highestIndex: 0, skippedCount: SKIP_LIMIT + 1 }]]),
    });

    await assert.rejects(() => bob.decrypt(padded), /skip limit exceeded/i);
  });
});
