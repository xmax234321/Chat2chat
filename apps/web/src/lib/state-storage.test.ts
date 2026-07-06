import 'fake-indexeddb/auto';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initStateStorage,
  loadState,
  saveState,
  lockStateStorage,
  unlockStateStorage,
  clearAllStateStorage,
  isStateStorageLocked,
  enablePinStateEncryption,
  flushStateStorage,
  localStorageContainsSecrets,
} from './state-storage.ts';
import { idbGet } from './state-idb.ts';
import { saveAppLockPassword, loadStoredAppLock } from './app-lock.ts';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('state-storage PIN lock', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
    localStorageMock.clear();
  });

  afterEach(async () => {
    await clearAllStateStorage();
  });

  it('loadState omits messages while PIN-encrypted storage is locked', async () => {
    await initStateStorage();

    saveState({ onboardingDone: true });
    saveState({
      messages: [
        {
          id: 'm1',
          contactId: 'c1',
          timestamp: 1,
          outgoing: true,
          content: { kind: 'text', body: 'secret' },
        },
      ],
    });
    await flushStateStorage();

    saveAppLockPassword('1234');
    const stored = loadStoredAppLock();
    assert.ok(stored);
    await enablePinStateEncryption('1234', stored.salt);
    await flushStateStorage();

    lockStateStorage();
    assert.equal(isStateStorageLocked(), true);

    const locked = loadState();
    assert.equal(locked.messages, undefined);
    assert.equal(locked.onboardingDone, true);

    const ok = await unlockStateStorage('1234');
    assert.equal(ok, true);
    const open = loadState();
    assert.equal(open.messages?.length, 1);
    assert.equal(
      open.messages?.[0]?.content.kind === 'text' ? open.messages[0].content.body : '',
      'secret',
    );
  });
});

describe('state-storage security', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
    localStorageMock.clear();
  });

  afterEach(async () => {
    await clearAllStateStorage();
  });

  it('does not leave mnemonic or readable messages in localStorage after login', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const messageBody = 'super-secret-message-content-xyz';

    localStorageMock.setItem(
      'chat2chat-web-state',
      JSON.stringify({
        onboardingDone: true,
        identity: { mnemonic },
        messages: [
          {
            id: 'm1',
            contactId: 'c1',
            direction: 'out',
            content: { kind: 'text', body: messageBody },
            timestamp: 1,
          },
        ],
      }),
    );

    await initStateStorage();
    saveState({
      messages: [
        {
          id: 'm2',
          contactId: 'c1',
          direction: 'in',
          content: { kind: 'text', body: 'another-secret-body' },
          timestamp: 2,
        },
      ],
    });
    await flushStateStorage();

    assert.equal(localStorageMock.getItem('chat2chat-web-state'), null);
    assert.equal(localStorageMock.getItem('chat2chat-web-sealed'), null);
    assert.equal(localStorageMock.getItem('chat2chat-device-key'), null);
    assert.equal(localStorageContainsSecrets(mnemonic, messageBody), false);

    for (const key of Object.keys((localStorageMock as { getItem: (k: string) => string | null }).getItem ? {} : {})) {
      /* iterate via known keys */
    }
    const meta = localStorageMock.getItem('chat2chat-web-meta');
    if (meta) {
      assert.ok(!meta.includes(mnemonic));
      assert.ok(!meta.includes(messageBody));
    }
  });

  it('stores sealed payload in IndexedDB, not localStorage', async () => {
    await initStateStorage();
    saveState({
      contacts: [{ userId: 'c2c_x', fingerprint: 'ff', alias: 'Bob', verified: false, avatar: '' }],
    });
    await flushStateStorage();

    const sealed = await idbGet('sealed');
    assert.ok(sealed, 'sealed envelope should be in IndexedDB');
    assert.ok(!sealed.includes('"alias":"Bob"'), 'contacts must be encrypted in IndexedDB');
    assert.equal(localStorageMock.getItem('chat2chat-web-sealed'), null);
  });
});
