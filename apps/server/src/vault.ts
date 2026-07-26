import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export interface StoredVaultEntry {
  ciphertext: string;
  version: number;
  updatedAt: number;
}

const vaultStore = new Map<string, StoredVaultEntry>();

function vaultFilePath(): string {
  return path.join(config.dataDir, 'user-vaults.json');
}

export async function loadVaultStore(): Promise<void> {
  try {
    await mkdir(config.dataDir, { recursive: true });
    const raw = await readFile(vaultFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, StoredVaultEntry>;
    vaultStore.clear();
    for (const [userId, entry] of Object.entries(parsed)) {
      vaultStore.set(userId, entry);
    }
  } catch {
    /* first boot */
  }
}

async function persistVaultStore(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const obj = Object.fromEntries(vaultStore.entries());
  await writeFile(vaultFilePath(), JSON.stringify(obj), 'utf8');
}

/**
 * No separate auth secret anymore — ownership of userId is proven per
 * request by an Ed25519 signature (checked in api.ts before these are
 * called), so a bare read/write here is safe.
 */
export function getUserVault(userId: string): StoredVaultEntry | null {
  return vaultStore.get(userId) ?? null;
}

export function putUserVault(
  userId: string,
  ciphertext: string,
  version: number,
): StoredVaultEntry {
  const existing = vaultStore.get(userId);
  if (existing && version < existing.version) {
    throw new Error('Stale vault version');
  }
  const entry: StoredVaultEntry = {
    ciphertext,
    version,
    updatedAt: Date.now(),
  };
  vaultStore.set(userId, entry);
  void persistVaultStore();
  return entry;
}
