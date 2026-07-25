import { NONCE_BYTES, toArrayBuffer } from './types.js';

const INFO_PREFIX = new TextEncoder().encode('chunk-nonce');

/** HKDF expand from cached PRK — one extract per file, fast per-index expand. */
export class ChunkNonceDeriver {
  private constructor(private readonly prk: CryptoKey) {}

  static async fromFileKey(fileKey: Uint8Array): Promise<ChunkNonceDeriver> {
    const prkBytes = await hkdfExtract(new Uint8Array(0), fileKey);
    const prk = await crypto.subtle.importKey(
      'raw',
      prkBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    return new ChunkNonceDeriver(prk);
  }

  async derive(index: number): Promise<Uint8Array> {
    const info = new Uint8Array(INFO_PREFIX.length + 4);
    info.set(INFO_PREFIX, 0);
    new DataView(info.buffer).setUint32(INFO_PREFIX.length, index, false);
    const expanded = await hkdfExpandHmac(this.prk, info, NONCE_BYTES);
    return expanded;
  }
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<ArrayBuffer> {
  const saltKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(salt.length ? salt : new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', saltKey, toArrayBuffer(ikm));
}

async function hkdfExpandHmac(prk: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hashLen = 32;
  const blocks = Math.ceil(length / hashLen);
  const out = new Uint8Array(blocks * hashLen);
  let prev = new Uint8Array(0);

  for (let i = 1; i <= blocks; i += 1) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev, 0);
    input.set(info, prev.length);
    input[input.length - 1] = i;
    const block = new Uint8Array(await crypto.subtle.sign('HMAC', prk, toArrayBuffer(input)));
    out.set(block, (i - 1) * hashLen);
    prev = block;
  }

  return out.subarray(0, length);
}

export async function importAesGcmKey(fileKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toArrayBuffer(fileKey), { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptAesGcm(
  key: CryptoKey,
  nonce: Uint8Array,
  plaintext: Uint8Array,
): Promise<{ ciphertext: Uint8Array; authTag: Uint8Array }> {
  const combined = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce), tagLength: 128 }, key, toArrayBuffer(plaintext)),
  );
  const tagStart = combined.length - 16;
  return {
    ciphertext: combined.subarray(0, tagStart),
    authTag: combined.subarray(tagStart),
  };
}

export async function decryptAesGcm(
  key: CryptoKey,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  authTag: Uint8Array,
): Promise<Uint8Array> {
  const combined = concatTag(ciphertext, authTag);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce), tagLength: 128 }, key, toArrayBuffer(combined)),
  );
  return plain;
}

function concatTag(ciphertext: Uint8Array, authTag: Uint8Array): Uint8Array {
  const out = new Uint8Array(ciphertext.length + authTag.length);
  out.set(ciphertext, 0);
  out.set(authTag, ciphertext.length);
  return out;
}
