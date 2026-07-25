/**
 * Encrypted at-rest storage for app state.
 * - Sensitive fields (messages, contacts, identity) are AES-256-GCM sealed in IndexedDB.
 * - With app PIN: key derived from PIN (fast HMAC; legacy PBKDF2 migrated on unlock).
 * - On native without PIN: device key stored in iOS Keychain.
 * - On web without PIN: device key in IndexedDB (never localStorage).
 * - Mnemonic on native is stored only in Keychain, never localStorage/IndexedDB plaintext.
 * - localStorage holds only non-secret meta (onboarding, lock prefs, UI settings).
 */
import { deriveKeyFromPassword, encryptWithPassword, decryptWithPassword } from '@chat2chat/crypto/browser';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { isCapacitor } from './platform';
import { secureStorageGet, secureStorageRemove, secureStorageSet, secureStorageSetBiometric, secureStorageRemoveBiometric } from './native-secure-storage';
import { idbClear, idbGet, idbRemove, idbSet } from './state-idb';
import type { AppState } from './types';
import type { ChatMessage } from './types';

const LEGACY_KEY = 'chat2chat-web-state';
const LEGACY_SEALED_KEY = 'chat2chat-web-sealed';
const LEGACY_DEVICE_KEY = 'chat2chat-device-key';
const META_KEY = 'chat2chat-web-meta';

const KEYCHAIN_DEVICE_KEY = 'device-encryption-key';
const KEYCHAIN_MNEMONIC = 'identity-mnemonic';
import { secureStorageGetBiometric } from '../lib/native-secure-storage';

const KEYCHAIN_BIOMETRIC_SEAL_KEY = 'biometric-seal-key';
const KEYCHAIN_BIOMETRIC_SEAL_KEY_FAST = 'biometric-seal-key-fast';

const STORAGE_VERSION = 3;

type MetaState = Pick<AppState, 'onboardingDone' | 'appLock' | 'appLockPrefs' | 'settings' | 'userProfile' | 'accountCreatedAt'> & {
  v: number;
  sealed: boolean;
  chatReadCursors?: AppState['chatReadCursors'];
};

type SealedState = {
  identity?: { mnemonic?: string };
  contacts?: AppState['contacts'];
  messages?: AppState['messages'];
  groups?: AppState['groups'];
  groupInvites?: AppState['groupInvites'];
  notifications?: AppState['notifications'];
  callHistory?: AppState['callHistory'];
  serverUrl?: AppState['serverUrl'];
};

interface SealedEnvelope {
  salt: string;
  nonce: string;
  ciphertext: string;
}

let sealedCache: Partial<SealedState> = {};
let activeKey: Uint8Array | null = null;
let storageLocked = false;
let initPromise: Promise<void> | null = null;
let initDone = false;
let persistSealedTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersistSealed(): void {
  if (persistSealedTimer) clearTimeout(persistSealedTimer);
  persistSealedTimer = setTimeout(() => {
    persistSealedTimer = null;
    void persistSealed();
  }, 350);
}

function sanitizeMessagesForStorage(messages?: ChatMessage[]): ChatMessage[] | undefined {
  if (!messages) return messages;
  return messages.map((message) => {
    if (message.content.kind === 'text' || message.content.kind === 'group_invite' || message.content.kind === 'export_block_notice') return message;
    const { previewUrl: _previewUrl, uploading: _uploading, uploadProgress: _uploadProgress, ...rest } = message.content;
    return { ...message, content: rest };
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

function readMeta(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { v: STORAGE_VERSION, sealed: false };
    return JSON.parse(raw) as MetaState;
  } catch {
    return { v: STORAGE_VERSION, sealed: false };
  }
}

function writeMeta(meta: MetaState): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

async function readSealedEnvelope(): Promise<SealedEnvelope | null> {
  try {
    const raw = await idbGet('sealed');
    if (!raw) return null;
    return JSON.parse(raw) as SealedEnvelope;
  } catch {
    return null;
  }
}

async function writeSealedEnvelope(envelope: SealedEnvelope | null): Promise<void> {
  if (!envelope) {
    await idbRemove('sealed');
    return;
  }
  await idbSet('sealed', JSON.stringify(envelope));
}

function sealPayload(key: Uint8Array, payload: SealedState): SealedEnvelope {
  const keyMaterial = bytesToBase64(key);
  const blob = encryptWithPassword(keyMaterial, utf8ToBytes(JSON.stringify(payload)));
  return {
    salt: bytesToBase64(blob.salt),
    nonce: bytesToBase64(blob.nonce),
    ciphertext: bytesToBase64(blob.ciphertext),
  };
}

function openSealedPayload(key: Uint8Array, envelope: SealedEnvelope): SealedState {
  const keyMaterial = bytesToBase64(key);
  const plain = decryptWithPassword(keyMaterial, {
    salt: base64ToBytes(envelope.salt),
    nonce: base64ToBytes(envelope.nonce),
    ciphertext: base64ToBytes(envelope.ciphertext),
  });
  return JSON.parse(new TextDecoder().decode(plain)) as SealedState;
}

function splitLegacyState(state: Partial<AppState>): { meta: MetaState; sealed: SealedState } {
  const {
    onboardingDone,
    appLock,
    appLockPrefs,
    settings,
    userProfile,
    accountCreatedAt,
    identity,
    contacts,
    messages,
    groups,
    groupInvites,
    notifications,
    chatReadCursors,
    callHistory,
    serverUrl,
  } = state;
  return {
    meta: { v: STORAGE_VERSION, sealed: true, onboardingDone, appLock, appLockPrefs, settings, userProfile, accountCreatedAt, chatReadCursors },
    sealed: { identity, contacts, messages, groups, groupInvites, notifications, callHistory, serverUrl },
  };
}

async function getOrCreateDeviceKey(): Promise<Uint8Array> {
  if (isCapacitor()) {
    const existing = await secureStorageGet(KEYCHAIN_DEVICE_KEY);
    if (existing) return base64ToBytes(existing);
    const key = randomBytes(32);
    await secureStorageSet(KEYCHAIN_DEVICE_KEY, bytesToBase64(key));
    return key;
  }
  const existing = await idbGet('device-key');
  if (existing) return base64ToBytes(existing);
  const key = randomBytes(32);
  await idbSet('device-key', bytesToBase64(key));
  return key;
}

async function migrateMnemonicToKeychain(sealed: SealedState): Promise<SealedState> {
  if (!isCapacitor() || !sealed.identity?.mnemonic) return sealed;
  await secureStorageSet(KEYCHAIN_MNEMONIC, sealed.identity.mnemonic);
  const { mnemonic: _mnemonic, ...restIdentity } = sealed.identity;
  return {
    ...sealed,
    identity: Object.keys(restIdentity).length ? restIdentity : undefined,
  };
}

async function hydrateMnemonicFromKeychain(sealed: Partial<SealedState>): Promise<Partial<SealedState>> {
  if (!isCapacitor()) return sealed;
  const mnemonic = await secureStorageGet(KEYCHAIN_MNEMONIC);
  if (!mnemonic) return sealed;
  return {
    ...sealed,
    identity: { ...(sealed.identity ?? {}), mnemonic },
  };
}

function extractSealedPatch(patch: Partial<AppState>): Partial<SealedState> {
  const sealed: Partial<SealedState> = {};
  if ('identity' in patch) sealed.identity = patch.identity;
  if ('contacts' in patch) sealed.contacts = patch.contacts;
  if ('messages' in patch) sealed.messages = patch.messages;
  if ('groups' in patch) sealed.groups = patch.groups;
  if ('groupInvites' in patch) sealed.groupInvites = patch.groupInvites;
  if ('notifications' in patch) sealed.notifications = patch.notifications;
  if ('callHistory' in patch) sealed.callHistory = patch.callHistory;
  if ('serverUrl' in patch) sealed.serverUrl = patch.serverUrl;
  return sealed;
}

function extractMetaPatch(patch: Partial<AppState>): Partial<MetaState> {
  const meta: Partial<MetaState> = {};
  if ('onboardingDone' in patch) meta.onboardingDone = patch.onboardingDone;
  if ('appLock' in patch) meta.appLock = patch.appLock;
  if ('appLockPrefs' in patch) meta.appLockPrefs = patch.appLockPrefs;
  if ('settings' in patch) meta.settings = patch.settings;
  if ('userProfile' in patch) meta.userProfile = patch.userProfile;
  if ('accountCreatedAt' in patch) meta.accountCreatedAt = patch.accountCreatedAt;
  if ('chatReadCursors' in patch) meta.chatReadCursors = patch.chatReadCursors;
  return meta;
}

async function persistSealed(): Promise<void> {
  if (!activeKey) return;
  let payload = { ...sealedCache } as SealedState;
  if (isCapacitor() && payload.identity?.mnemonic) {
    await secureStorageSet(KEYCHAIN_MNEMONIC, payload.identity.mnemonic);
    const { mnemonic: _mnemonic, ...restIdentity } = payload.identity;
    payload = { ...payload, identity: restIdentity };
  }
  await writeSealedEnvelope(sealPayload(activeKey, payload));
  writeMeta({ ...readMeta(), v: STORAGE_VERSION, sealed: true });
}

function hasPinEncryption(): boolean {
  const meta = readMeta();
  return Boolean(meta.appLock?.salt && meta.appLock?.verifier);
}

export function hasPinSealedStorage(): boolean {
  return hasPinEncryption();
}

/** Unlock encrypted storage after a successful biometric prompt. */
export async function unlockStorageAfterBiometricAuth(): Promise<boolean> {
  if (!isStateStorageLocked()) return true;

  if (!hasPinEncryption()) {
    storageLocked = false;
    return true;
  }

  const keyB64 = await secureStorageGet(KEYCHAIN_BIOMETRIC_SEAL_KEY_FAST);
  if (keyB64) return unlockStateStorageWithKey(base64ToBytes(keyB64));

  const protectedKey = await secureStorageGetBiometric(KEYCHAIN_BIOMETRIC_SEAL_KEY, 'Unlock Chat2Chat');
  if (protectedKey) return unlockStateStorageWithKey(base64ToBytes(protectedKey));

  return false;
}

function derivePinSealKey(pin: string, salt: Uint8Array): Uint8Array {
  return hmac(sha256, salt, utf8ToBytes(`chat2chat-pin-seal-v3:${pin}`));
}

async function unlockWithKey(key: Uint8Array): Promise<boolean> {
  const envelope = await readSealedEnvelope();
  if (!envelope) {
    activeKey = key;
    storageLocked = false;
    return true;
  }
  try {
    const opened = openSealedPayload(key, envelope);
    sealedCache = await hydrateMnemonicFromKeychain(opened);
    activeKey = key;
    storageLocked = false;
    return true;
  } catch {
    return false;
  }
}

/** Move sealed blob + device key from localStorage into IndexedDB. */
async function migrateLocalStorageSealedToIdb(): Promise<void> {
  const legacySealed = localStorage.getItem(LEGACY_SEALED_KEY);
  if (legacySealed && !(await idbGet('sealed'))) {
    await idbSet('sealed', legacySealed);
    localStorage.removeItem(LEGACY_SEALED_KEY);
  }

  const legacyDeviceKey = localStorage.getItem(LEGACY_DEVICE_KEY);
  if (legacyDeviceKey && !(await idbGet('device-key'))) {
    await idbSet('device-key', legacyDeviceKey);
    localStorage.removeItem(LEGACY_DEVICE_KEY);
  }
}

async function migrateLegacyState(): Promise<void> {
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (!legacyRaw) return;

  let legacy: Partial<AppState>;
  try {
    legacy = JSON.parse(legacyRaw) as Partial<AppState>;
  } catch {
    localStorage.removeItem(LEGACY_KEY);
    return;
  }

  const { meta, sealed } = splitLegacyState(legacy);
  const migratedSealed = await migrateMnemonicToKeychain(sealed);
  sealedCache = migratedSealed;

  const hasPin = Boolean(meta.appLock?.salt && meta.appLock?.verifier);
  if (hasPin) {
    writeMeta({ ...meta, v: STORAGE_VERSION, sealed: true });
    await writeSealedEnvelope(null);
    storageLocked = true;
    activeKey = null;
  } else {
    const deviceKey = await getOrCreateDeviceKey();
    activeKey = deviceKey;
    storageLocked = false;
    writeMeta({ ...meta, v: STORAGE_VERSION, sealed: true });
    await writeSealedEnvelope(sealPayload(deviceKey, migratedSealed));
  }

  localStorage.removeItem(LEGACY_KEY);
}

/** Initialize storage (migration + auto-unlock when no PIN). Call once at app start. */
export async function initStateStorage(): Promise<void> {
  if (initDone) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await migrateLocalStorageSealedToIdb();
    await migrateLegacyState();

    const meta = readMeta();
    const hasPin = Boolean(meta.appLock?.salt && meta.appLock?.verifier);
    const envelope = await readSealedEnvelope();

    if (!envelope) {
      storageLocked = hasPin;
      if (!hasPin) activeKey = await getOrCreateDeviceKey();
      initDone = true;
      return;
    }

    if (hasPin) {
      storageLocked = true;
      activeKey = null;
    } else {
      const deviceKey = await getOrCreateDeviceKey();
      await unlockWithKey(deviceKey);
    }

    initDone = true;
  })();

  return initPromise;
}

export function isStateStorageReady(): boolean {
  return initDone;
}

export function isStateStorageLocked(): boolean {
  return storageLocked;
}

/** Unlock sealed storage with a derived sealing key. Returns false on wrong key. */
export async function unlockStateStorageWithKey(key: Uint8Array): Promise<boolean> {
  return unlockWithKey(key);
}

/** Unlock sealed storage with app PIN. Returns false on wrong PIN. */
export async function unlockStateStorage(pin: string): Promise<boolean> {
  const meta = readMeta();
  if (!meta.appLock?.salt) return false;
  const salt = base64ToBytes(meta.appLock.salt);
  const fastKey = derivePinSealKey(pin, salt);
  if (await unlockWithKey(fastKey)) return true;

  const pinKey = deriveKeyFromPassword(pin, salt);
  if (await unlockWithKey(pinKey)) {
    activeKey = fastKey;
    storageLocked = false;
    await persistSealed();
    return true;
  }

  // Post-migration: legacy plaintext may have been sealed with the device key.
  const deviceKey = await getOrCreateDeviceKey();
  if (await unlockWithKey(deviceKey)) {
    activeKey = fastKey;
    storageLocked = false;
    await persistSealed();
    return true;
  }
  return false;
}

export function lockStateStorage(): void {
  storageLocked = true;
  if (hasPinEncryption()) {
    sealedCache = {};
    activeKey = null;
  }
}

/** Store the active sealing key for biometric unlock (native only, storage must be unlocked). */
export async function storeBiometricUnlockKey(): Promise<boolean> {
  if (!isCapacitor() || storageLocked || !activeKey) return false;
  const keyB64 = bytesToBase64(activeKey);
  const fastOk = await secureStorageSet(KEYCHAIN_BIOMETRIC_SEAL_KEY_FAST, keyB64);
  void secureStorageSetBiometric(KEYCHAIN_BIOMETRIC_SEAL_KEY, keyB64);
  return fastOk;
}

/** Remove biometric sealing key from Keychain. */
export async function clearBiometricUnlockKey(): Promise<void> {
  await secureStorageRemoveBiometric(KEYCHAIN_BIOMETRIC_SEAL_KEY);
  await secureStorageRemove(KEYCHAIN_BIOMETRIC_SEAL_KEY_FAST);
}

/**
 * Unlock sealed storage via Face ID / Touch ID.
 * Caller should run authenticateBiometric first when prompting the user.
 */
export async function unlockStateStorageWithBiometricKey(): Promise<boolean> {
  return unlockStorageAfterBiometricAuth();
}

/** Reload sealed cache from disk when re-opening after UI lock (Face ID). */
export async function reloadSealedCache(): Promise<boolean> {
  if (!activeKey || !(await readSealedEnvelope())) return false;
  return unlockWithKey(activeKey);
}

export function loadState(): Partial<AppState> {
  const meta = readMeta();
  if (storageLocked) {
    return {
      onboardingDone: meta.onboardingDone,
      appLock: meta.appLock,
      appLockPrefs: meta.appLockPrefs,
      settings: meta.settings,
      userProfile: meta.userProfile,
      accountCreatedAt: meta.accountCreatedAt,
      chatReadCursors: meta.chatReadCursors,
    };
  }

  const legacyCursors = (sealedCache as { chatReadCursors?: AppState['chatReadCursors'] }).chatReadCursors;
  const chatReadCursors = meta.chatReadCursors ?? legacyCursors;
  if (!meta.chatReadCursors && legacyCursors && Object.keys(legacyCursors).length > 0) {
    writeMeta({ ...meta, chatReadCursors: legacyCursors, v: STORAGE_VERSION, sealed: true });
    if (legacyCursors) {
      const { chatReadCursors: _removed, ...rest } = sealedCache as SealedState & {
        chatReadCursors?: AppState['chatReadCursors'];
      };
      sealedCache = rest;
      if (activeKey) schedulePersistSealed();
    }
  }

  return {
    onboardingDone: meta.onboardingDone,
    appLock: meta.appLock,
    appLockPrefs: meta.appLockPrefs,
    settings: meta.settings,
    userProfile: meta.userProfile,
    accountCreatedAt: meta.accountCreatedAt,
    chatReadCursors,
    ...sealedCache,
  };
}

export function saveState(patch: Partial<AppState>): void {
  const metaPatch = extractMetaPatch(patch);
  if (Object.keys(metaPatch).length > 0) {
    writeMeta({ ...readMeta(), ...metaPatch, v: STORAGE_VERSION, sealed: true });
  }

  const sealedPatch = extractSealedPatch(patch);
  if (Object.keys(sealedPatch).length > 0) {
    if (storageLocked) {
      throw new Error('Cannot save sealed state while locked');
    }
    if ('messages' in sealedPatch) {
      sealedPatch.messages = sanitizeMessagesForStorage(sealedPatch.messages);
    }
    sealedCache = { ...sealedCache, ...sealedPatch };
    if (!activeKey) return;
    schedulePersistSealed();
  }
}

/** Force synchronous flush of sealed data (for logout). */
export async function flushStateStorage(): Promise<void> {
  if (persistSealedTimer) {
    clearTimeout(persistSealedTimer);
    persistSealedTimer = null;
  }
  if (activeKey && !storageLocked) {
    await persistSealed();
  }
}

export async function clearAllStateStorage(): Promise<void> {
  localStorage.removeItem(META_KEY);
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(LEGACY_SEALED_KEY);
  localStorage.removeItem(LEGACY_DEVICE_KEY);
  await idbClear();
  await secureStorageRemove(KEYCHAIN_DEVICE_KEY);
  await secureStorageRemove(KEYCHAIN_MNEMONIC);
  await clearBiometricUnlockKey();
  sealedCache = {};
  activeKey = null;
  storageLocked = false;
  initDone = false;
  initPromise = null;
}

/** Re-key sealed storage when PIN changes. Must be called while unlocked. */
export async function rekeyStateStorage(newPin: string, pinSalt: string): Promise<void> {
  if (storageLocked || !activeKey) throw new Error('Storage must be unlocked to rekey');
  await persistSealed();
  activeKey = derivePinSealKey(newPin, base64ToBytes(pinSalt));
  await persistSealed();
}

/** Enable PIN encryption on existing unlocked storage. */
export async function enablePinStateEncryption(pin: string, pinSalt: string): Promise<void> {
  if (storageLocked) throw new Error('Storage must be unlocked');
  await persistSealed();
  activeKey = derivePinSealKey(pin, base64ToBytes(pinSalt));
  storageLocked = false;
  await persistSealed();
}

/** Disable PIN encryption — fall back to device key. */
export async function disablePinStateEncryption(): Promise<void> {
  activeKey = await getOrCreateDeviceKey();
  storageLocked = false;
  await persistSealed();
}

export async function loadIdentityMnemonic(): Promise<string | null> {
  if (isCapacitor()) {
    return secureStorageGet(KEYCHAIN_MNEMONIC);
  }
  return sealedCache.identity?.mnemonic ?? null;
}

/** Scan localStorage values for leaked secrets (test helper). */
export function localStorageContainsSecrets(mnemonic: string, messageBody: string): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? '';
    if (value.includes(mnemonic)) return true;
    if (value.includes(messageBody) && value.includes('"messages"')) return true;
    if (key === LEGACY_KEY || key === LEGACY_SEALED_KEY) return true;
  }
  return false;
}
