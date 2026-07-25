import { ed25519, x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

const ID_PREFIX = 'c2c_';
const HKDF_INFO_SIGN = 'chat2chat-identity-ed25519-v1';
const HKDF_INFO_DH = 'chat2chat-identity-x25519-v1';

export interface KeyPairBytes {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface Identity {
  /** ~97 character user ID derived from public keys */
  userId: string;
  /** Ed25519 signing key pair */
  signing: KeyPairBytes;
  /** X25519 key agreement pair */
  dh: KeyPairBytes;
  /** 60-char hex fingerprint for MITM verification */
  fingerprint: string;
  /** BIP39 mnemonic used to derive keys (only present at creation/recovery) */
  mnemonic?: string;
}

export interface SeedConfirmationState {
  mnemonic: string;
  confirmed: boolean;
  acknowledgedHistoryLoss: boolean;
}

/** Encode bytes as URL-safe base64 without padding (browser + Node) */
export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode URL-safe base64 */
export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + '='.repeat(pad));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** CRC32 checksum as 4 uppercase hex chars */
function crc32Hex(data: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
}

function deriveSigningKeyPair(masterSeed: Uint8Array): KeyPairBytes {
  const sk = hkdf(sha256, masterSeed, undefined, utf8ToBytes(HKDF_INFO_SIGN), 32);
  const publicKey = ed25519.getPublicKey(sk);
  return { privateKey: sk, publicKey };
}

function deriveDhKeyPair(masterSeed: Uint8Array): KeyPairBytes {
  const sk = hkdf(sha256, masterSeed, undefined, utf8ToBytes(HKDF_INFO_DH), 32);
  const publicKey = x25519.getPublicKey(sk);
  return { privateKey: sk, publicKey };
}

/** Build user ID from public keys: c2c_<ed25519_b64url><x25519_b64url><CRC> */
export function buildUserId(signingPublicKey: Uint8Array, dhPublicKey: Uint8Array): string {
  const payload = new Uint8Array([...signingPublicKey, ...dhPublicKey]);
  const checksum = crc32Hex(payload);
  return (
    ID_PREFIX +
    base64UrlEncode(signingPublicKey) +
    base64UrlEncode(dhPublicKey) +
    checksum
  );
}

/** Parse user ID back to public keys. Throws if invalid. */
export function parseUserId(userId: string): { signingPublicKey: Uint8Array; dhPublicKey: Uint8Array } {
  if (!userId.startsWith(ID_PREFIX)) {
    throw new Error('Invalid user ID: missing prefix');
  }
  const body = userId.slice(ID_PREFIX.length);
  if (body.length < 88) {
    throw new Error('Invalid user ID: too short');
  }
  const checksum = body.slice(-4);
  const keysPart = body.slice(0, -4);
  // Ed25519 and X25519 pubkeys are 32 bytes each → 43 chars base64url each
  const signingB64 = keysPart.slice(0, 43);
  const dhB64 = keysPart.slice(43);
  const signingPublicKey = base64UrlDecode(signingB64);
  const dhPublicKey = base64UrlDecode(dhB64);
  const payload = new Uint8Array([...signingPublicKey, ...dhPublicKey]);
  if (crc32Hex(payload) !== checksum) {
    throw new Error('Invalid user ID: checksum mismatch');
  }
  return { signingPublicKey, dhPublicKey };
}

/** Compute security fingerprint for contact verification */
export function computeFingerprint(signingPublicKey: Uint8Array, dhPublicKey: Uint8Array): string {
  const combined = new Uint8Array([...signingPublicKey, ...dhPublicKey]);
  return bytesToHex(sha256(combined)).slice(0, 60);
}

/** Generate a new identity with fresh BIP39 mnemonic */
export function generateIdentity(wordCount: 12 | 24 = 12): Identity {
  const strength = wordCount === 24 ? 256 : 128;
  const mnemonic = generateMnemonic(wordlist, strength);
  return identityFromMnemonic(mnemonic);
}

/** Restore identity from existing mnemonic */
export function identityFromMnemonic(mnemonic: string): Identity {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid BIP39 mnemonic');
  }
  const masterSeed = mnemonicToSeedSync(normalized);
  const signing = deriveSigningKeyPair(masterSeed);
  const dh = deriveDhKeyPair(masterSeed);
  const userId = buildUserId(signing.publicKey, dh.publicKey);
  const fingerprint = computeFingerprint(signing.publicKey, dh.publicKey);
  return { userId, signing, dh, fingerprint, mnemonic: normalized };
}

/** Deep link for adding a contact */
export function contactDeepLink(userId: string): string {
  return `chat2chat://add/${userId}`;
}

/** Format fingerprint for display (groups of 5) */
export function formatFingerprint(fingerprint: string): string {
  return fingerprint.match(/.{1,5}/g)?.join(' ') ?? fingerprint;
}

/** Sign arbitrary data with identity Ed25519 key */
export function sign(identity: Identity, data: Uint8Array): Uint8Array {
  return ed25519.sign(data, identity.signing.privateKey);
}

/** Verify Ed25519 signature against a user ID */
export function verify(userId: string, data: Uint8Array, signature: Uint8Array): boolean {
  const { signingPublicKey } = parseUserId(userId);
  return ed25519.verify(signature, data, signingPublicKey);
}

/** Export identity keys for secure storage (never store mnemonic here) */
export function exportIdentitySecrets(identity: Identity): {
  userId: string;
  signingPrivateKey: Uint8Array;
  dhPrivateKey: Uint8Array;
  fingerprint: string;
} {
  return {
    userId: identity.userId,
    signingPrivateKey: identity.signing.privateKey,
    dhPrivateKey: identity.dh.privateKey,
    fingerprint: identity.fingerprint,
  };
}

/** Reconstruct identity from stored secrets (no mnemonic) */
export function identityFromSecrets(secrets: {
  userId: string;
  signingPrivateKey: Uint8Array;
  dhPrivateKey: Uint8Array;
}): Identity {
  const signingPublicKey = ed25519.getPublicKey(secrets.signingPrivateKey);
  const dhPublicKey = x25519.getPublicKey(secrets.dhPrivateKey);
  const expectedId = buildUserId(signingPublicKey, dhPublicKey);
  if (expectedId !== secrets.userId) {
    throw new Error('Stored keys do not match user ID');
  }
  return {
    userId: secrets.userId,
    signing: { privateKey: secrets.signingPrivateKey, publicKey: signingPublicKey },
    dh: { privateKey: secrets.dhPrivateKey, publicKey: dhPublicKey },
    fingerprint: computeFingerprint(signingPublicKey, dhPublicKey),
  };
}

export { hexToBytes, bytesToHex, utf8ToBytes };
