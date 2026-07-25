import { identityFromMnemonic } from '@chat2chat/crypto/browser';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { mnemonicToSeedSync } from '@scure/bip39';
import { isCapacitor, isIosCapacitor } from './platform';
import { encryptMnemonicForFile, buildFileUnlockSecret, buildLegacyFileUnlockSecret, decryptMnemonicFromFile, type SeedCipher } from './recovery-vault';

export const OWNERSHIP_PROOF_FORMAT = 'chat2chat-ownership-proof' as const;

export interface OwnershipProofFile {
  format: typeof OWNERSHIP_PROOF_FORMAT;
  version: 1;
  userId: string;
  issuedAt: string;
  /** @deprecated Legacy files may include a recovery email in metadata. */
  recoveryEmail?: string;
  proofSeal: string;
  seedCipher?: SeedCipher;
  verification: {
    requires: Array<'userId' | 'seedPhrase' | 'recoveryEmail'>;
    emailConfirmation: boolean;
  };
}

export interface OwnershipVerificationInput {
  userId: string;
  mnemonic: string;
  proof?: OwnershipProofFile | null;
}

export interface OwnershipVerificationResult {
  ok: boolean;
  reason?: string;
  steps: {
    userId: boolean;
    seedPhrase: boolean;
    proofSeal: boolean;
  };
}

function sealKey(mnemonic: string): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
  return hmac(sha256, seed, utf8ToBytes('chat2chat-ownership-proof-v1'));
}

function canonicalPayload(data: Omit<OwnershipProofFile, 'proofSeal'>): string {
  return JSON.stringify({
    format: data.format,
    version: data.version,
    userId: data.userId,
    issuedAt: data.issuedAt,
    recoveryEmail: data.recoveryEmail ?? null,
    emailConfirmation: data.verification.emailConfirmation,
  });
}

function computeSeal(mnemonic: string, payload: Omit<OwnershipProofFile, 'proofSeal'>): string {
  const mac = hmac(sha256, sealKey(mnemonic), utf8ToBytes(canonicalPayload(payload)));
  return Array.from(mac as Uint8Array, (b: number) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildOwnershipProof(
  userId: string,
  mnemonic: string,
  filePassword?: string,
): Promise<OwnershipProofFile> {
  const password = filePassword?.trim() ?? '';
  if (password.length < 6) {
    throw new Error('File password must be at least 6 characters');
  }
  const issuedAt = new Date().toISOString();
  const base: Omit<OwnershipProofFile, 'proofSeal' | 'seedCipher'> = {
    format: OWNERSHIP_PROOF_FORMAT,
    version: 1,
    userId,
    issuedAt,
    verification: {
      requires: ['userId', 'seedPhrase'],
      emailConfirmation: false,
    },
  };
  const proof: OwnershipProofFile = { ...base, proofSeal: computeSeal(mnemonic, base) };
  const secret = buildFileUnlockSecret(userId, password);
  proof.seedCipher = await encryptMnemonicForFile(mnemonic, secret);
  return proof;
}

export function verifyProofSeal(proof: OwnershipProofFile, mnemonic: string): boolean {
  const { proofSeal, ...rest } = proof;
  return computeSeal(mnemonic, rest) === proofSeal;
}

export function parseOwnershipProofFile(raw: string): OwnershipProofFile {
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  let parsed: OwnershipProofFile;
  try {
    parsed = JSON.parse(trimmed) as OwnershipProofFile;
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (parsed.format !== OWNERSHIP_PROOF_FORMAT || parsed.version !== 1) {
    throw new Error('Unsupported ownership proof file');
  }
  if (!parsed.userId?.startsWith('c2c_') || !parsed.proofSeal) {
    throw new Error('Invalid ownership proof file');
  }
  return parsed;
}

export function verifyAccountOwnership(input: OwnershipVerificationInput): OwnershipVerificationResult {
  const steps = {
    userId: false,
    seedPhrase: false,
    proofSeal: false,
  };

  let derivedId: string;
  try {
    derivedId = identityFromMnemonic(input.mnemonic.trim().toLowerCase()).userId;
    steps.seedPhrase = true;
  } catch {
    return { ok: false, reason: 'Invalid seed phrase', steps };
  }

  steps.userId = derivedId === input.userId;
  if (!steps.userId) {
    return { ok: false, reason: 'Seed phrase does not match this ID', steps };
  }

  if (input.proof) {
    if (input.proof.userId !== input.userId) {
      return { ok: false, reason: 'Proof file is for a different ID', steps };
    }
    steps.proofSeal = verifyProofSeal(input.proof, input.mnemonic);
    if (!steps.proofSeal) {
      return { ok: false, reason: 'Proof file seal is invalid', steps };
    }
  }

  const ok = steps.userId && steps.seedPhrase && (!input.proof || steps.proofSeal);
  return { ok, steps };
}

export function downloadOwnershipProofFile(proof: OwnershipProofFile): void {
  const blob = new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeId = proof.userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat2chat-login-${safeId}.c2cproof.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Save ownership proof — app Backups folder on mobile, browser download elsewhere. */
export async function saveOwnershipProofFile(
  proof: OwnershipProofFile,
): Promise<{ mode: 'saved' | 'downloaded'; filename: string; uri?: string }> {
  const content = JSON.stringify(proof, null, 2);
  const filename = ownershipProofFilename(proof.userId);

  if (isCapacitor()) {
    if (isIosCapacitor()) {
      const { BackupExport } = await import('./native-backup-export');
      const result = await BackupExport.writeBackupFile({ filename, content });
      return { mode: 'saved', filename, uri: result.uri };
    }

    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const written = await Filesystem.writeFile({
      path: `Backups/${filename}`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const uri = written.uri || (await Filesystem.getUri({ path: `Backups/${filename}`, directory: Directory.Documents })).uri;
    return { mode: 'saved', filename, uri };
  }

  downloadOwnershipProofFile(proof);
  return { mode: 'downloaded', filename };
}

export function ownershipProofFilename(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  return `chat2chat-login-${safeId}.c2cproof.json`;
}

export async function decryptSeedFromProof(
  proof: OwnershipProofFile,
  filePassword: string,
): Promise<string> {
  if (!proof.seedCipher) {
    throw new Error('This file does not contain an encrypted seed');
  }
  const password = filePassword.trim();
  try {
    return await decryptMnemonicFromFile(
      proof.seedCipher,
      buildFileUnlockSecret(proof.userId, password),
    );
  } catch {
    return decryptMnemonicFromFile(
      proof.seedCipher,
      buildLegacyFileUnlockSecret(proof.userId, proof.recoveryEmail, password),
    );
  }
}
