import { gcm } from '@noble/ciphers/aes';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptedBlob {
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function deriveKeyFromPassword(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, utf8ToBytes(password), salt, { c: PBKDF2_ITERATIONS, dkLen: KEY_LENGTH });
}

export function encryptWithPassword(password: string, plaintext: Uint8Array): EncryptedBlob {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKeyFromPassword(password, salt);
  const nonce = randomBytes(NONCE_LENGTH);
  const ciphertext = gcm(key, nonce).encrypt(plaintext);
  return { salt, nonce, ciphertext };
}

export function decryptWithPassword(password: string, blob: EncryptedBlob): Uint8Array {
  const key = deriveKeyFromPassword(password, blob.salt);
  return gcm(key, blob.nonce).decrypt(blob.ciphertext);
}

export function padToBucket(plaintext: Uint8Array, bucketSize = 512): Uint8Array {
  if (plaintext.length > bucketSize - 2) {
    throw new Error(`Message exceeds bucket size ${bucketSize}`);
  }
  const padded = new Uint8Array(bucketSize);
  padded[0] = (plaintext.length >> 8) & 0xff;
  padded[1] = plaintext.length & 0xff;
  padded.set(plaintext, 2);
  return padded;
}

export function unpadFromBucket(padded: Uint8Array): Uint8Array {
  const length = (padded[0]! << 8) | padded[1]!;
  return padded.slice(2, 2 + length);
}
