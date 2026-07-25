import { deriveKeyFromPassword } from '@chat2chat/crypto/browser';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { loadState, saveState } from './types';

export type AppLockPasscodeType = '4' | '6' | 'alphanumeric';

/** @deprecated use AppLockPasscodeType */
export const APP_LOCK_PIN_LENGTHS = [4, 6] as const;
/** @deprecated use AppLockPasscodeType */
export type AppLockPinLength = (typeof APP_LOCK_PIN_LENGTHS)[number];
/** @deprecated */
export const APP_LOCK_PIN_LENGTH = 4;
/** @deprecated */
export const APP_LOCK_MIN_LENGTH = APP_LOCK_PIN_LENGTH;

export interface StoredAppLock {
  salt: string;
  verifier: string;
  /** @deprecated use passcodeType */
  pinLength?: 4 | 6;
  passcodeType?: AppLockPasscodeType;
}

const PASSCODE_TYPE_LABELS: Record<AppLockPasscodeType, string> = {
  '4': '4-Digit Code',
  '6': '6-Digit Code',
  alphanumeric: 'Numbers & Letters',
};

export function passcodeTypeLabel(type: AppLockPasscodeType): string {
  return PASSCODE_TYPE_LABELS[type];
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function computeVerifier(pin: string, salt: Uint8Array): string {
  const key = deriveKeyFromPassword(pin, salt);
  const mac = hmac(sha256, key, utf8ToBytes('chat2chat-app-lock-v1'));
  return bytesToHex(mac);
}

function computeVerifierFast(pin: string, salt: Uint8Array): string {
  const mac = hmac(sha256, salt, utf8ToBytes(`chat2chat-app-lock-v2:${pin}`));
  return bytesToHex(mac);
}

export function loadAppLockPasscodeType(): AppLockPasscodeType {
  const stored = loadStoredAppLock();
  if (stored?.passcodeType) return stored.passcodeType;
  return stored?.pinLength === 6 ? '6' : '4';
}

/** @deprecated use loadAppLockPasscodeType */
export function loadAppLockPinLength(): AppLockPinLength {
  const type = loadAppLockPasscodeType();
  return type === '6' ? 6 : 4;
}

export function digitCountForPasscodeType(type: AppLockPasscodeType): number | null {
  if (type === '4') return 4;
  if (type === '6') return 6;
  return null;
}

export function validateAppLockPasscode(pin: string, type = loadAppLockPasscodeType()): string | null {
  if (type === 'alphanumeric') {
    if (pin.length < 4) return 'Passcode must be at least 4 characters';
    if (!/^[a-zA-Z0-9]+$/.test(pin)) return 'Use only letters and numbers';
    return null;
  }
  const len = type === '6' ? 6 : 4;
  if (!/^\d+$/.test(pin)) return 'PIN must contain only digits';
  if (pin.length !== len) return `PIN must be ${len} digits`;
  return null;
}

/** @deprecated use validateAppLockPasscode */
export function validateAppLockPin(pin: string, length = loadAppLockPinLength()): string | null {
  const type: AppLockPasscodeType = length === 6 ? '6' : '4';
  return validateAppLockPasscode(pin, type);
}

/** @deprecated use validateAppLockPasscode */
export const validateAppLockPassword = validateAppLockPasscode;

export function loadStoredAppLock(): StoredAppLock | null {
  const lock = loadState().appLock;
  if (!lock?.salt || !lock?.verifier) return null;
  return lock;
}

export function isAppLockConfigured(): boolean {
  return loadStoredAppLock() !== null;
}

export function verifyAppLockPassword(pin: string, stored = loadStoredAppLock()): boolean {
  if (!stored) return true;
  try {
    const type = stored.passcodeType ?? (stored.pinLength === 6 ? '6' : '4');
    if (type !== 'alphanumeric') {
      const expectedLength = type === '6' ? 6 : 4;
      if (pin.length !== expectedLength) return false;
    }
    const salt = base64ToBytes(stored.salt);
    if (stored.verifier.startsWith('v2:')) {
      const expectedFast = computeVerifierFast(pin, salt);
      return constantTimeEqual(expectedFast, stored.verifier.slice(3));
    }

    const expectedLegacy = computeVerifier(pin, salt);
    const ok = constantTimeEqual(expectedLegacy, stored.verifier);
    if (ok) {
      const legacyType = stored.pinLength === 6 ? '6' : '4';
      saveState({
        appLock: {
          salt: stored.salt,
          verifier: `v2:${computeVerifierFast(pin, salt)}`,
          pinLength: legacyType === '6' ? 6 : 4,
          passcodeType: legacyType,
        },
      });
    }
    return ok;
  } catch {
    return false;
  }
}

export function saveAppLockPassword(pin: string, passcodeType: AppLockPasscodeType = '4'): void {
  const err = validateAppLockPasscode(pin, passcodeType);
  if (err) throw new Error(err);
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const stored: StoredAppLock = {
    salt: bytesToBase64(salt),
    verifier: `v2:${computeVerifierFast(pin, salt)}`,
    passcodeType,
    pinLength: passcodeType === '6' ? 6 : passcodeType === '4' ? 4 : undefined,
  };
  saveState({ appLock: stored });
}

export function clearAppLock(): void {
  saveState({ appLock: undefined });
}
