import { encryptWithPassword, decryptWithPassword, base64UrlEncode, base64UrlDecode } from '@chat2chat/crypto/browser';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { pickRelayUrls, preferredRelayEndpoints } from './server-url';

export type UserVaultPlaintext = {
  version: number;
  exportBlocks: Record<string, number>;
};

const VAULT_SCOPE = 'chat2chat-user-vault-v1';

export function buildVaultAuthToken(mnemonic: string, userId: string): string {
  const key = sha256(utf8ToBytes(`${mnemonic.trim().toLowerCase()}:${VAULT_SCOPE}`));
  return base64UrlEncode(hmac(sha256, key, utf8ToBytes(userId)));
}

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

export async function fetchUserVault(
  userId: string,
  mnemonic: string,
  relay = preferredRelayEndpoints(),
): Promise<UserVaultPlaintext | null> {
  const endpoints = await pickRelayUrls(relay);
  const auth = buildVaultAuthToken(mnemonic, userId);
  const res = await fetch(`${endpoints.http}/vault/${encodeURIComponent(userId)}?auth=${encodeURIComponent(auth)}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { ciphertext?: string };
  if (!body.ciphertext) return null;
  return decryptUserVault(mnemonic, body.ciphertext);
}

export async function uploadUserVault(
  userId: string,
  mnemonic: string,
  payload: UserVaultPlaintext,
  relay = preferredRelayEndpoints(),
): Promise<void> {
  const endpoints = await pickRelayUrls(relay);
  const auth = buildVaultAuthToken(mnemonic, userId);
  const ciphertext = encryptUserVault(mnemonic, payload);
  const res = await fetch(`${endpoints.http}/vault/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth, ciphertext, version: payload.version }),
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
