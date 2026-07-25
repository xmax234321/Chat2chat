import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '@chat2chat/crypto';
import { EncryptedStore } from './encrypted-store.js';
import { utf8ToBytes } from '@noble/hashes/utils';

describe('EncryptedStore', () => {
  it('saves and loads identity', () => {
    const store = EncryptedStore.openInMemory('test-password-123');
    const identity = generateIdentity();
    store.saveIdentity(identity);
    const loaded = store.loadIdentity();
    assert.ok(loaded);
    assert.equal(loaded!.userId, identity.userId);
    store.close();
  });

  it('stores encrypted messages', () => {
    const store = EncryptedStore.openInMemory('pw');
    const identity = generateIdentity();
    store.saveIdentity(identity);
    const contact = generateIdentity();
    store.addContact({
      userId: contact.userId,
      fingerprint: contact.fingerprint,
      alias: 'Alice',
      verified: false,
      createdAt: Date.now(),
    });
    store.saveMessage({
      id: 'msg-1',
      contactId: contact.userId,
      direction: 'out',
      ciphertext: utf8ToBytes('encrypted-blob'),
      contentKind: 'text',
      timestamp: Date.now(),
      delivered: true,
    });
    const msgs = store.getMessages(contact.userId);
    assert.equal(msgs.length, 1);
    assert.deepEqual(msgs[0]!.ciphertext, utf8ToBytes('encrypted-blob'));
    store.close();
  });
});
