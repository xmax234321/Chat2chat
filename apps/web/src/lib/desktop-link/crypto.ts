import { padToBucket, unpadFromBucket } from '@chat2chat/crypto/browser';

async function derivePairKey(token: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`chat2chat-desktop-link-v1:${token}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('desktop-link'), iterations: 120_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface DesktopPairBundle {
  mnemonic: string;
  contacts: unknown[];
  messages: unknown[];
  settings: unknown;
}

export async function encryptPairBundle(token: string, bundle: DesktopPairBundle): Promise<string> {
  const key = await derivePairKey(token);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(bundle));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptPairBundle(token: string, encoded: string): Promise<DesktopPairBundle> {
  const key = await derivePairKey(token);
  const bin = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = bin.slice(0, 12);
  const cipher = bin.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain)) as DesktopPairBundle;
}

/** Chunk large BLE writes (iOS MTU ~185). */
export function chunkBlePayload(base64: string, maxChunk = 160): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += maxChunk) {
    chunks.push(base64.slice(i, i + maxChunk));
  }
  return chunks.map((part, index, all) =>
    JSON.stringify({ kind: 'chunk', index, total: all.length, data: part }),
  );
}

export function assembleBleChunks(parts: string[]): string | null {
  const chunks: Array<{ index: number; total: number; data: string }> = [];
  for (const part of parts) {
    try {
      chunks.push(JSON.parse(part));
    } catch {
      return null;
    }
  }
  if (!chunks.length) return null;
  const total = chunks[0]!.total;
  if (chunks.length !== total) return null;
  chunks.sort((a, b) => a.index - b.index);
  return chunks.map((c) => c.data).join('');
}

export function padRelayPayload(json: string): Uint8Array {
  return padToBucket(new TextEncoder().encode(json), 512);
}

export function unpadRelayPayload(bucket: Uint8Array): string {
  return new TextDecoder().decode(unpadFromBucket(bucket));
}
