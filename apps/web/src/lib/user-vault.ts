import {
  encryptWithPassword,
  decryptWithPassword,
  base64UrlEncode,
  base64UrlDecode,
  sign,
  utf8ToBytes,
  type Identity,
} from '@chat2chat/crypto/browser';
import { pickRelayUrls, preferredRelayEndpoints } from './server-url';

export type UserVaultPlaintext = {
  version: number;
  exportBlocks: Record<string, number>;
};

const VAULT_SCOPE = 'chat2chat-user-vault-v1';

export function encryptUserVault(mnemonic: string, payload: UserVaultPlaintext): string {
  const bytes = utf8ToBytes(JSON.stringify(payload));
  const blob = encryptWithPassword(`${mnemonic.trim().toLowerCase()}:${VAULT_SCOPE}`, bytes);
  const packed = new Uint8Array(blob.salt.length + blob.nonce.length + blob.ciphertext.length);
  packed.set(blob.salt, 0);
  packed.set(blob.nonce, blob.salt.length);
  packed.set(blob.ciphertext, blob.salt.length + blob.nonce.length);
  return base64UrlEncode(packed);
}

export function decryptUserVault(mnemonic: string, packedB64: string): UserVaultPlaintext | null {
  try {
    const packed = base64UrlDecode(packedB64);
    const salt = packed.slice(0, 16);
    const nonce = packed.slice(16, 28);
    const ciphertext = packed.slice(28);
    const bytes = decryptWithPassword(`${mnemonic.trim().toLowerCase()}:${VAULT_SCOPE}`, {
      salt,
      nonce,
      ciphertext,
    });
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as UserVaultPlaintext;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') return null;
    if (!parsed.exportBlocks || typeof parsed.exportBlocks !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function vaultApiBase(http: string): string {
  const base = http.replace(/\/$/, '');
  return `${base}/api/v1/vault`;
}

export async function fetchUserVault(
  identity: Identity,
  mnemonic: string,
  relay = preferredRelayEndpoints(),
): Promise<UserVaultPlaintext | null> {
  const endpoints = await pickRelayUrls(relay);
  const userId = identity.userId;
  const timestamp = Date.now();
  const message = `vault-get:${userId}:${timestamp}`;
  const signature = base64UrlEncode(sign(identity, utf8ToBytes(message)));
  const url = new URL(`${vaultApiBase(endpoints.http)}/${encodeURIComponent(userId)}`);
  url.searchParams.set('timestamp', String(timestamp));
  url.searchParams.set('signature', signature);
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { ciphertext?: string };
  if (!body.ciphertext) return null;
  return decryptUserVault(mnemonic, body.ciphertext);
}

export async function uploadUserVault(
  identity: Identity,
  mnemonic: string,
  payload: UserVaultPlaintext,
  relay = preferredRelayEndpoints(),
): Promise<void> {
  const endpoints = await pickRelayUrls(relay);
  const userId = identity.userId;
  const ciphertext = encryptUserVault(mnemonic, payload);
  const timestamp = Date.now();
  const message = `vault-put:${userId}:${payload.version}:${timestamp}:${ciphertext}`;
  const signature = base64UrlEncode(sign(identity, utf8ToBytes(message)));
  const res = await fetch(`${vaultApiBase(endpoints.http)}/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext, version: payload.version, timestamp, signature }),
  });
  if (!res.ok) {
    throw new Error('Vault sync failed');
  }
}

export function exportBlocksFromContacts(
  contacts: Array<{ userId: string; exportBlockForPeerAt?: number }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const contact of contacts) {
    if (contact.exportBlockForPeerAt) out[contact.userId] = contact.exportBlockForPeerAt;
  }
  return out;
}
