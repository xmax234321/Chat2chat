import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export interface StoredVaultEntry {
  ciphertext: string;
  version: number;
  auth: string;
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

export function getUserVault(userId: string, auth: string): StoredVaultEntry | null {
  const entry = vaultStore.get(userId);
  if (!entry || entry.auth !== auth) return null;
  return entry;
}

export function putUserVault(
  userId: string,
  auth: string,
  ciphertext: string,
  version: number,
): StoredVaultEntry {
  const existing = vaultStore.get(userId);
  if (existing && existing.auth !== auth) {
    throw new Error('Vault auth mismatch');
  }
  if (existing && version < existing.version) {
    throw new Error('Stale vault version');
  }
  const entry: StoredVaultEntry = {
    ciphertext,
    version,
    auth,
    updatedAt: Date.now(),
  };
  vaultStore.set(userId, entry);
  void persistVaultStore();
  return entry;
}
