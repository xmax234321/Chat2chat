const PBKDF2_ITERATIONS = 120_000;

export interface SeedCipher {
  kdf: 'pbkdf2-sha256-aes-gcm';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

async function deriveAesKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toBufferSource(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptMnemonicForFile(mnemonic: string, secret: string): Promise<SeedCipher> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toBufferSource(iv) },
    key,
    new TextEncoder().encode(mnemonic.trim().toLowerCase()),
  );
  return {
    kdf: 'pbkdf2-sha256-aes-gcm',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ciphertext)),
  };
}

export async function decryptMnemonicFromFile(cipher: SeedCipher, secret: string): Promise<string> {
  if (cipher.kdf !== 'pbkdf2-sha256-aes-gcm') {
    throw new Error('Unsupported seed encryption');
  }
  const salt = b64ToBytes(cipher.salt);
  const iv = b64ToBytes(cipher.iv);
  const key = await deriveAesKey(secret, salt);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toBufferSource(iv) },
    key,
    toBufferSource(b64ToBytes(cipher.ciphertext)),
  );
  return new TextDecoder().decode(plain).trim().toLowerCase();
}

/** Build unlock secret for file encryption (memorized file password only). */
export function buildFileUnlockSecret(userId: string, filePassword: string): string {
  return `${userId}|${filePassword.trim()}`;
}

/** @deprecated Legacy files mixed recovery email into the unlock secret. */
export function buildLegacyFileUnlockSecret(
  userId: string,
  recoveryEmail: string | null | undefined,
  unlock: string,
): string {
  const email = recoveryEmail?.trim().toLowerCase() || '';
  return `${userId}|${email}|${unlock.trim()}`;
}