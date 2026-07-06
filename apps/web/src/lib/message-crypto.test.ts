import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptIncomingMessage,
  encryptOutgoingMessage,
} from './message-crypto.ts';

describe('message-crypto client padding path', () => {
  it('bucket padding without session provider does not advance a ratchet chain (no forward secrecy)', async () => {
    const plain = new TextEncoder().encode('same plaintext');
    const first = await encryptOutgoingMessage('contact-a', plain);
    const second = await encryptOutgoingMessage('contact-a', plain);

    // Deterministic, stateless padding: identical output means no per-message key rotation.
    assert.deepEqual(first, second);

    // No contact-bound session: different contacts get the same independent framing.
    const otherContact = await encryptOutgoingMessage('contact-b', plain);
    assert.deepEqual(first, otherContact);

    const recovered = await decryptIncomingMessage('contact-a', first);
    assert.deepEqual(recovered, plain);
  });
});
